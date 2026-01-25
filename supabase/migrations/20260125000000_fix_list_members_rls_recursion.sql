-- ===========================================
-- FIX: RLS Infinite Recursion Issues
-- ===========================================
-- 
-- PROBLEM: Circular dependencies between RLS policies cause "infinite recursion" errors.
-- - shopping_lists policies query list_members and family_members
-- - list_members policies query shopping_lists
-- - items policies query shopping_lists
-- This creates loops that PostgreSQL cannot resolve.
--
-- SOLUTION: Use SECURITY DEFINER helper functions that bypass RLS when checking
-- ownership/membership. This breaks the recursion cycle.
--
-- ===========================================


-- ===========================================
-- STEP 1: Drop ALL existing policies that will be recreated
-- ===========================================

-- list_members policies
DROP POLICY IF EXISTS "Users can view list memberships" ON public.list_members;
DROP POLICY IF EXISTS "Users can view members of their lists" ON public.list_members;
DROP POLICY IF EXISTS "List owners can manage members" ON public.list_members;
DROP POLICY IF EXISTS "List owners can update members" ON public.list_members;
DROP POLICY IF EXISTS "List owners can remove members" ON public.list_members;

-- shopping_lists policies
DROP POLICY IF EXISTS "Users can create lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Users can update own lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Users can view own lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Users can view own and family-shared lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Users can view shared lists" ON public.shopping_lists;

-- items policies
DROP POLICY IF EXISTS "Users can add items to own and family-shared lists" ON public.items;
DROP POLICY IF EXISTS "Users can add items to their lists" ON public.items;
DROP POLICY IF EXISTS "Users can delete items from own and family-shared lists" ON public.items;
DROP POLICY IF EXISTS "Users can delete own items" ON public.items;
DROP POLICY IF EXISTS "Users can update items in own and family-shared lists" ON public.items;
DROP POLICY IF EXISTS "Users can update own items" ON public.items;
DROP POLICY IF EXISTS "Users can view items in own and family-shared lists" ON public.items;
DROP POLICY IF EXISTS "Users can view items in their lists" ON public.items;

-- family_members policies
DROP POLICY IF EXISTS "Owners can insert family members" ON public.family_members;
DROP POLICY IF EXISTS "Owners can update family members" ON public.family_members;
DROP POLICY IF EXISTS "Owners can remove members or members can leave" ON public.family_members;
DROP POLICY IF EXISTS "View family members" ON public.family_members;


-- ===========================================
-- STEP 2: Drop and recreate helper functions
-- ===========================================

DROP FUNCTION IF EXISTS public.user_owns_list(uuid);
DROP FUNCTION IF EXISTS public.user_owns_list(uuid, uuid);
DROP FUNCTION IF EXISTS public.user_is_list_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_list_member(uuid);
DROP FUNCTION IF EXISTS public.get_user_family_member_ids(uuid);
DROP FUNCTION IF EXISTS public.get_list_members_for_owner(uuid);

-- Function to check if user owns a list (via shopping_lists)
CREATE OR REPLACE FUNCTION public.user_owns_list(p_list_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.shopping_lists
        WHERE id = p_list_id
        AND owner_id = p_user_id
    );
$$;

-- Function to check if user is a list member (two param version)
CREATE OR REPLACE FUNCTION public.user_is_list_member(p_list_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.list_members
        WHERE list_id = p_list_id
        AND user_id = p_user_id
    );
$$;

-- Function to check if current user is a list member (single param version)
CREATE OR REPLACE FUNCTION public.is_list_member(p_list_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.list_members
        WHERE list_id = p_list_id
        AND user_id = auth.uid()
    );
$$;

-- Function to get all family member user IDs for a user
CREATE OR REPLACE FUNCTION public.get_user_family_member_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT fm.user_id 
    FROM public.family_members fm
    WHERE fm.family_group_id = (
        SELECT family_group_id FROM public.profiles WHERE id = p_user_id
    )
    AND fm.status = 'approved';
$$;


-- ===========================================
-- STEP 3: Recreate list_members policies
-- ===========================================

CREATE POLICY "List owners can manage members" ON public.list_members 
    FOR INSERT 
    WITH CHECK (user_owns_list(list_id, auth.uid()));

CREATE POLICY "List owners can remove members" ON public.list_members 
    FOR DELETE 
    USING (user_owns_list(list_id, auth.uid()) OR (user_id = auth.uid()));

CREATE POLICY "List owners can update members" ON public.list_members 
    FOR UPDATE 
    USING (user_owns_list(list_id, auth.uid()));

CREATE POLICY "Users can view members of their lists" ON public.list_members 
    FOR SELECT 
    USING (user_owns_list(list_id, auth.uid()) OR (user_id = auth.uid()));


-- ===========================================
-- STEP 4: Recreate shopping_lists policies
-- ===========================================

CREATE POLICY "Users can create lists" ON public.shopping_lists
    FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own lists" ON public.shopping_lists
    FOR DELETE
    USING (owner_id = auth.uid());

CREATE POLICY "Users can update own lists" ON public.shopping_lists
    FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "Users can view own and family-shared lists" ON public.shopping_lists
    FOR SELECT
    USING (
        -- User's own lists
        (owner_id = auth.uid())
        -- OR lists they're a member of (via helper function to avoid recursion)
        OR user_is_list_member(id, auth.uid())
        -- OR family-shared lists from approved family members
        OR (
            shared_with_family = true
            AND owner_id IN (SELECT get_user_family_member_ids(auth.uid()))
        )
    );

CREATE POLICY "Users can view shared lists" ON public.shopping_lists
    FOR SELECT
    USING (is_list_member(id));


-- ===========================================
-- STEP 5: Recreate items policies
-- ===========================================

CREATE POLICY "Users can add items to own and family-shared lists" ON public.items
    FOR INSERT
    WITH CHECK (
        user_owns_list(list_id, auth.uid()) 
        OR user_is_list_member(list_id, auth.uid()) 
        OR (list_id IN (
            SELECT id FROM public.shopping_lists
            WHERE shared_with_family = true
            AND owner_id IN (SELECT get_user_family_member_ids(auth.uid()))
        ))
    );

CREATE POLICY "Users can delete items from own and family-shared lists" ON public.items
    FOR DELETE
    USING (
        user_owns_list(list_id, auth.uid()) 
        OR user_is_list_member(list_id, auth.uid()) 
        OR (list_id IN (
            SELECT id FROM public.shopping_lists
            WHERE shared_with_family = true
            AND owner_id IN (SELECT get_user_family_member_ids(auth.uid()))
        ))
    );

CREATE POLICY "Users can update items in own and family-shared lists" ON public.items
    FOR UPDATE
    USING (
        user_owns_list(list_id, auth.uid()) 
        OR user_is_list_member(list_id, auth.uid()) 
        OR (list_id IN (
            SELECT id FROM public.shopping_lists
            WHERE shared_with_family = true
            AND owner_id IN (SELECT get_user_family_member_ids(auth.uid()))
        ))
    );

CREATE POLICY "Users can view items in own and family-shared lists" ON public.items
    FOR SELECT
    USING (
        user_owns_list(list_id, auth.uid()) 
        OR user_is_list_member(list_id, auth.uid()) 
        OR (list_id IN (
            SELECT id FROM public.shopping_lists
            WHERE shared_with_family = true
            AND owner_id IN (SELECT get_user_family_member_ids(auth.uid()))
        ))
    );


-- ===========================================
-- STEP 6: Recreate family_members policies
-- ===========================================

CREATE POLICY "Owners can insert family members" ON public.family_members
    FOR INSERT WITH CHECK (
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Owners can update family members" ON public.family_members
    FOR UPDATE USING (
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Owners can remove members or members can leave" ON public.family_members
    FOR DELETE USING (
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
        OR user_id = auth.uid()
    );

CREATE POLICY "View family members" ON public.family_members
    FOR SELECT USING (
        -- Owner can see all members
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
        -- Users can see their own membership
        OR user_id = auth.uid()
        -- Approved members can see other approved members in their group
        OR (
            status = 'approved'
            AND family_group_id IN (
                SELECT family_group_id FROM public.family_members
                WHERE user_id = auth.uid() AND status = 'approved'
            )
        )
    );
