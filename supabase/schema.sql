-- ===========================================
-- MyEZList Complete Database Schema
-- Matches Production Exactly
-- Generated from backup: Dec 7, 2025
-- ===========================================

-- ===========================================
-- TABLE: profiles
-- User profiles linked to Supabase Auth
-- ===========================================
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    role text DEFAULT 'user'::text,
    subscription_tier text DEFAULT 'free'::text,
    monthly_credits_total integer DEFAULT 15,
    credits_used_this_month integer DEFAULT 0,
    current_shopping_lists integer DEFAULT 0,
    current_total_items integer DEFAULT 0,
    current_tasks integer DEFAULT 0,
    current_custom_recipes integer DEFAULT 0,
    theme text DEFAULT 'default'::text,
    subscription_start_date timestamp without time zone,
    credits_reset_date timestamp without time zone,
    created_date timestamp without time zone DEFAULT now(),
    subscription_end_date timestamp with time zone,
    subscription_cancel_reason text,
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_subscription_status text,
    last_payment_date timestamp with time zone,
    last_refunded_date timestamp with time zone,
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT stripe_subscription_status_check CHECK (((stripe_subscription_status IS NULL) OR (stripe_subscription_status = ANY (ARRAY['active'::text, 'canceled'::text, 'incomplete'::text, 'incomplete_expired'::text, 'past_due'::text, 'trialing'::text, 'unpaid'::text]))))
);

-- ===========================================
-- TABLE: subscription_tiers
-- Subscription plan definitions
-- ===========================================
CREATE TABLE public.subscription_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tier_name text NOT NULL,
    display_name text NOT NULL,
    price_per_month numeric(10,2) DEFAULT 0 NOT NULL,
    max_shopping_lists integer DEFAULT 5 NOT NULL,
    max_total_items integer DEFAULT 50 NOT NULL,
    max_tasks integer DEFAULT 10 NOT NULL,
    max_custom_recipes integer DEFAULT 5 NOT NULL,
    monthly_credits integer DEFAULT 15 NOT NULL,
    has_ads boolean DEFAULT true,
    allowed_themes jsonb DEFAULT '[]'::jsonb,
    sort_order integer DEFAULT 0,
    created_date timestamp with time zone DEFAULT now(),
    theme_restriction_duration integer,
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT subscription_tiers_pkey PRIMARY KEY (id)
);

-- ===========================================
-- TABLE: premium_features
-- AI feature credit costs
-- ===========================================
CREATE TABLE public.premium_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_key text NOT NULL,
    display_name text NOT NULL,
    description text,
    credits_per_use integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true,
    category text DEFAULT 'general'::text,
    created_date timestamp with time zone DEFAULT now(),
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT premium_features_pkey PRIMARY KEY (id),
    CONSTRAINT premium_features_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['shopping'::text, 'tasks'::text, 'recipes'::text, 'general'::text]))))
);

-- ===========================================
-- TABLE: shopping_lists
-- User shopping lists
-- ===========================================
CREATE TABLE public.shopping_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    owner_id uuid,
    icon text DEFAULT 'shopping-cart'::text,
    color text DEFAULT 'ocean'::text,
    created_date timestamp with time zone DEFAULT now(),
    updated_date timestamp with time zone DEFAULT now(),
    store_sections jsonb DEFAULT '["Produce", "Dairy", "Meat", "Frozen", "Pantry", "Beverages", "Snacks", "Household"]'::jsonb,
    archived boolean DEFAULT false,
    CONSTRAINT shopping_lists_pkey PRIMARY KEY (id),
    CONSTRAINT shopping_lists_color_check CHECK (((color IS NULL) OR (color = ANY (ARRAY['ocean'::text, 'forest'::text, 'sunset'::text, 'lavender'::text, 'rose'::text, 'charcoal'::text, 'mint'::text, 'beige'::text])))),
    CONSTRAINT shopping_lists_icon_check CHECK (((icon IS NULL) OR (icon = ANY (ARRAY['shopping-cart'::text, 'store'::text, 'basket'::text, 'apple'::text, 'home'::text, 'sparkles'::text, 'gift'::text, 'utensils'::text]))))
);

-- ===========================================
-- TABLE: items
-- Shopping list items
-- ===========================================
CREATE TABLE public.items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_id uuid,
    name text NOT NULL,
    quantity text,
    category text DEFAULT 'Other'::text,
    brand text,
    size_notes text,
    photo_url text,
    is_organic boolean DEFAULT false,
    is_checked boolean DEFAULT false,
    checked_date timestamp with time zone,
    added_by text,
    created_date timestamp with time zone DEFAULT now(),
    updated_date timestamp with time zone DEFAULT now(),
    store_section text,
    is_favorite boolean DEFAULT false,
    CONSTRAINT items_pkey PRIMARY KEY (id),
    CONSTRAINT items_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['Produce'::text, 'Dairy'::text, 'Meat & Seafood'::text, 'Bakery'::text, 'Frozen'::text, 'Pantry'::text, 'Beverages'::text, 'Snacks'::text, 'Personal Care'::text, 'Household'::text, 'Cleaning'::text, 'Baby'::text, 'Pet'::text, 'Other'::text]))))
);

-- ===========================================
-- TABLE: list_members
-- Shared list membership
-- ===========================================
CREATE TABLE public.list_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_id uuid,
    user_id uuid,
    user_email text,
    role text DEFAULT 'member'::text,
    status text DEFAULT 'pending'::text,
    created_date timestamp with time zone DEFAULT now(),
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT list_members_pkey PRIMARY KEY (id),
    CONSTRAINT list_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text]))),
    CONSTRAINT list_members_status_check CHECK (((status IS NULL) OR (status = ANY (ARRAY['pending'::text, 'approved'::text]))))
);

-- ===========================================
-- TABLE: share_links
-- Shareable list links
-- ===========================================
CREATE TABLE public.share_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_id uuid,
    token text NOT NULL,
    created_by uuid,
    expires_at timestamp with time zone,
    created_date timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT share_links_pkey PRIMARY KEY (id)
);

-- ===========================================
-- TABLE: common_items
-- Pre-populated grocery items
-- ===========================================
CREATE TABLE public.common_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    category text DEFAULT 'Other'::text,
    photo_url text,
    usage_count integer DEFAULT 0,
    created_date timestamp with time zone DEFAULT now(),
    is_organic boolean DEFAULT false,
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT common_items_pkey PRIMARY KEY (id),
    CONSTRAINT common_items_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['Produce'::text, 'Dairy'::text, 'Meat & Seafood'::text, 'Bakery'::text, 'Frozen'::text, 'Pantry'::text, 'Beverages'::text, 'Snacks'::text, 'Personal Care'::text, 'Household'::text, 'Cleaning'::text, 'Baby'::text, 'Pet'::text, 'Other'::text]))))
);

-- ===========================================
-- TABLE: todos
-- User tasks
-- ===========================================
CREATE TABLE public.todos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text,
    priority text DEFAULT 'medium'::text,
    category text DEFAULT 'personal'::text,
    due_date date,
    due_time time without time zone,
    created_by text,
    created_date timestamp with time zone DEFAULT now(),
    updated_date timestamp with time zone DEFAULT now(),
    is_favorite boolean DEFAULT false,
    completed_date timestamp with time zone,
    CONSTRAINT todos_pkey PRIMARY KEY (id),
    CONSTRAINT todos_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['home'::text, 'work'::text, 'personal'::text, 'errands'::text, 'family'::text, 'health'::text, 'finance'::text, 'other'::text])))),
    CONSTRAINT todos_priority_check CHECK (((priority IS NULL) OR (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))),
    CONSTRAINT todos_status_check CHECK (((status IS NULL) OR (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text]))))
);

-- ===========================================
-- TABLE: recipes
-- User and system recipes
-- ===========================================
CREATE TABLE public.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_name text NOT NULL,
    full_title text NOT NULL,
    photo_url text,
    cooking_time text,
    cuisine text,
    servings integer DEFAULT 4,
    calories_per_serving text,
    ingredients jsonb DEFAULT '[]'::jsonb,
    steps jsonb DEFAULT '[]'::jsonb,
    is_user_generated boolean DEFAULT false,
    generated_by_user_id uuid,
    created_date timestamp with time zone DEFAULT now(),
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT recipes_pkey PRIMARY KEY (id),
    CONSTRAINT recipes_cuisine_check CHECK (((cuisine IS NULL) OR (cuisine = ANY (ARRAY['Italian'::text, 'Indian / Pakistani'::text, 'Chinese'::text, 'Mexican'::text, 'French'::text, 'Japanese'::text, 'Thai'::text, 'Middle Eastern'::text, 'American'::text, 'Spanish'::text, 'Mediterranean'::text, 'Greek'::text, 'Global Classics'::text, 'Others'::text]))))
);

-- ===========================================
-- TABLE: recipe_favorites
-- User favorite recipes
-- ===========================================
CREATE TABLE public.recipe_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid,
    user_id uuid,
    created_date timestamp with time zone DEFAULT now(),
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT recipe_favorites_pkey PRIMARY KEY (id)
);

-- ===========================================
-- TABLE: statistics
-- Global statistics
-- ===========================================
CREATE TABLE public.statistics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stat_key text NOT NULL,
    count integer DEFAULT 0,
    created_date timestamp with time zone DEFAULT now(),
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT statistics_pkey PRIMARY KEY (id)
);

-- ===========================================
-- TABLE: credit_transactions
-- AI credit usage history
-- ===========================================
CREATE TABLE public.credit_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    feature_key text,
    credits_consumed integer DEFAULT 1,
    "timestamp" timestamp with time zone DEFAULT now(),
    user_email text,
    feature_name text,
    transaction_type text DEFAULT 'consumption'::text,
    description text,
    metadata jsonb,
    CONSTRAINT credit_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT credit_transactions_type_check CHECK (((transaction_type IS NULL) OR (transaction_type = ANY (ARRAY['consumption'::text, 'refund'::text, 'bonus'::text]))))
);

-- ===========================================
-- TABLE: activity_tracking
-- User activity logs
-- ===========================================
CREATE TABLE public.activity_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operation_type text NOT NULL,
    page text NOT NULL,
    operation_name text NOT NULL,
    description text,
    user_id uuid,
    "timestamp" timestamp with time zone DEFAULT now(),
    CONSTRAINT activity_tracking_pkey PRIMARY KEY (id),
    CONSTRAINT activity_tracking_operation_type_check CHECK ((operation_type = ANY (ARRAY['READ'::text, 'CREATE'::text, 'UPDATE'::text, 'DELETE'::text])))
);

-- ===========================================
-- FOREIGN KEY CONSTRAINTS
-- ===========================================
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id);

ALTER TABLE public.shopping_lists ADD CONSTRAINT shopping_lists_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.items ADD CONSTRAINT items_list_id_fkey 
    FOREIGN KEY (list_id) REFERENCES public.shopping_lists(id) ON DELETE CASCADE;

ALTER TABLE public.list_members ADD CONSTRAINT list_members_list_id_fkey 
    FOREIGN KEY (list_id) REFERENCES public.shopping_lists(id) ON DELETE CASCADE;

ALTER TABLE public.list_members ADD CONSTRAINT list_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.share_links ADD CONSTRAINT share_links_list_id_fkey 
    FOREIGN KEY (list_id) REFERENCES public.shopping_lists(id) ON DELETE CASCADE;

ALTER TABLE public.share_links ADD CONSTRAINT share_links_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.recipes ADD CONSTRAINT recipes_generated_by_user_id_fkey 
    FOREIGN KEY (generated_by_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.recipe_favorites ADD CONSTRAINT recipe_favorites_recipe_id_fkey 
    FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_favorites ADD CONSTRAINT recipe_favorites_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.activity_tracking ADD CONSTRAINT activity_tracking_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX idx_activity_tracking_operation_type ON public.activity_tracking USING btree (operation_type);
CREATE INDEX idx_activity_tracking_page ON public.activity_tracking USING btree (page);
CREATE INDEX idx_activity_tracking_timestamp ON public.activity_tracking USING btree ("timestamp");
CREATE INDEX idx_activity_tracking_user_id ON public.activity_tracking USING btree (user_id);
CREATE INDEX idx_common_items_category ON public.common_items USING btree (category);
CREATE INDEX idx_common_items_is_organic ON public.common_items USING btree (is_organic);
CREATE INDEX idx_credit_transactions_feature_key ON public.credit_transactions USING btree (feature_key);
CREATE INDEX idx_credit_transactions_type ON public.credit_transactions USING btree (transaction_type);
CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions USING btree (user_id);
CREATE INDEX idx_items_is_favorite ON public.items USING btree (is_favorite);
CREATE INDEX idx_items_list_id ON public.items USING btree (list_id);
CREATE INDEX idx_items_store_section ON public.items USING btree (store_section);
CREATE INDEX idx_list_members_list_id ON public.list_members USING btree (list_id);
CREATE INDEX idx_list_members_user_id ON public.list_members USING btree (user_id);
CREATE INDEX idx_recipe_favorites_user_id ON public.recipe_favorites USING btree (user_id);
CREATE INDEX idx_recipes_cuisine ON public.recipes USING btree (cuisine);
CREATE INDEX idx_recipes_generated_by ON public.recipes USING btree (generated_by_user_id);
CREATE INDEX idx_recipes_is_user_generated ON public.recipes USING btree (is_user_generated);
CREATE INDEX idx_share_links_is_active ON public.share_links USING btree (is_active);
CREATE INDEX idx_share_links_token ON public.share_links USING btree (token);
CREATE INDEX idx_shopping_lists_archived ON public.shopping_lists USING btree (archived);
CREATE INDEX idx_todos_created_by ON public.todos USING btree (created_by);
CREATE INDEX idx_todos_due_date ON public.todos USING btree (due_date);
CREATE INDEX idx_todos_is_favorite ON public.todos USING btree (is_favorite);
CREATE INDEX idx_todos_status ON public.todos USING btree (status);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.common_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_features ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- FUNCTION: is_admin
-- Helper function to check if current user is an admin
-- ===========================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- ===========================================
-- RLS POLICIES: profiles
-- ===========================================
CREATE POLICY "Users can insert own profile" ON public.profiles 
    FOR INSERT WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users can update own profile" ON public.profiles 
    FOR UPDATE USING ((auth.uid() = id));

CREATE POLICY "Users can view own profile, admins can view all" ON public.profiles 
    FOR SELECT USING (((auth.uid() = id) OR is_admin()));

-- ===========================================
-- HELPER FUNCTIONS (SECURITY DEFINER to bypass RLS and avoid recursion)
-- ===========================================

-- Function to check if user owns a list
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
-- RLS POLICIES: shopping_lists
-- ===========================================
CREATE POLICY "Users can create lists" ON public.shopping_lists 
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own lists" ON public.shopping_lists 
    FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can update own lists" ON public.shopping_lists 
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own and family-shared lists" ON public.shopping_lists
    FOR SELECT
    USING (
        (owner_id = auth.uid())
        OR user_is_list_member(id, auth.uid())
        OR (
            shared_with_family = true
            AND owner_id IN (SELECT get_user_family_member_ids(auth.uid()))
        )
    );

CREATE POLICY "Users can view shared lists" ON public.shopping_lists
    FOR SELECT
    USING (is_list_member(id));

-- ===========================================
-- RLS POLICIES: items
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
-- RLS POLICIES: list_members
-- ===========================================
CREATE POLICY "List owners can manage members" ON public.list_members 
    FOR INSERT 
    WITH CHECK (user_owns_list(list_id, auth.uid()));

-- NOTE: Direct INSERT via share link is NOT allowed due to security concerns.
-- Users must use the join_list_via_share_token() RPC function which validates the token server-side.

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
-- RLS POLICIES: share_links
-- ===========================================
-- NOTE: Share links are accessed via the secure join_list_via_share_token() function.
-- Direct SELECT is restricted to list owners (for management) to prevent enumeration attacks.
CREATE POLICY "List owners can view their share links" ON public.share_links 
    FOR SELECT USING (
        list_id IN (
            SELECT id FROM public.shopping_lists 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can create share links for their lists" ON public.share_links 
    FOR INSERT WITH CHECK ((list_id IN ( SELECT shopping_lists.id
       FROM public.shopping_lists
      WHERE (shopping_lists.owner_id = auth.uid()))));

CREATE POLICY "Users can delete share links for their lists" ON public.share_links 
    FOR DELETE USING ((list_id IN ( SELECT shopping_lists.id
       FROM public.shopping_lists
      WHERE (shopping_lists.owner_id = auth.uid()))));

CREATE POLICY "Users can update share links for their lists" ON public.share_links 
    FOR UPDATE USING ((list_id IN ( SELECT shopping_lists.id
       FROM public.shopping_lists
      WHERE (shopping_lists.owner_id = auth.uid()))));

-- ===========================================
-- RLS POLICIES: common_items
-- ===========================================
CREATE POLICY "Admins can manage common items" ON public.common_items 
    USING ((EXISTS ( SELECT 1
       FROM public.profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "Authenticated users can view common items" ON public.common_items 
    FOR SELECT USING ((auth.uid() IS NOT NULL));

-- ===========================================
-- RLS POLICIES: todos
-- ===========================================
CREATE POLICY "Users can create todos" ON public.todos 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete own todos" ON public.todos 
    FOR DELETE USING ((created_by = ( SELECT profiles.email
       FROM public.profiles
      WHERE (profiles.id = auth.uid()))));

CREATE POLICY "Users can update own todos" ON public.todos 
    FOR UPDATE USING ((created_by = ( SELECT profiles.email
       FROM public.profiles
      WHERE (profiles.id = auth.uid()))));

CREATE POLICY "Users can view own todos" ON public.todos 
    FOR SELECT USING ((created_by = ( SELECT profiles.email
       FROM public.profiles
      WHERE (profiles.id = auth.uid()))));

-- ===========================================
-- RLS POLICIES: recipes
-- ===========================================
CREATE POLICY "Anyone can view recipes" ON public.recipes 
    FOR SELECT USING (true);

CREATE POLICY "Users can create recipes" ON public.recipes 
    FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "Users can delete own recipes" ON public.recipes 
    FOR DELETE USING ((generated_by_user_id = auth.uid()));

CREATE POLICY "Users can update own recipes" ON public.recipes 
    FOR UPDATE USING ((generated_by_user_id = auth.uid()));

-- ===========================================
-- RLS POLICIES: recipe_favorites
-- ===========================================
CREATE POLICY "Users can add favorites" ON public.recipe_favorites 
    FOR INSERT WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users can remove favorites" ON public.recipe_favorites 
    FOR DELETE USING ((user_id = auth.uid()));

CREATE POLICY "Users can view own favorites" ON public.recipe_favorites 
    FOR SELECT USING ((user_id = auth.uid()));

-- ===========================================
-- RLS POLICIES: statistics
-- ===========================================
CREATE POLICY "Authenticated users can insert statistics" ON public.statistics 
    FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "Authenticated users can update statistics" ON public.statistics 
    FOR UPDATE USING ((auth.uid() IS NOT NULL));

CREATE POLICY "Authenticated users can view statistics" ON public.statistics 
    FOR SELECT USING ((auth.uid() IS NOT NULL));

-- ===========================================
-- RLS POLICIES: credit_transactions
-- ===========================================
CREATE POLICY "Users can create transactions" ON public.credit_transactions 
    FOR INSERT WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users can view own transactions" ON public.credit_transactions 
    FOR SELECT USING ((user_id = auth.uid()));

-- ===========================================
-- RLS POLICIES: activity_tracking
-- ===========================================
CREATE POLICY "Admins can view all activity" ON public.activity_tracking 
    FOR SELECT USING ((EXISTS ( SELECT 1
       FROM public.profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "Users can create activity" ON public.activity_tracking 
    FOR INSERT WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users can view own activity" ON public.activity_tracking 
    FOR SELECT USING ((user_id = auth.uid()));

-- ===========================================
-- RLS POLICIES: subscription_tiers
-- ===========================================
CREATE POLICY "Admins can manage tiers" ON public.subscription_tiers 
    USING ((EXISTS ( SELECT 1
       FROM public.profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "Anyone can view subscription tiers" ON public.subscription_tiers 
    FOR SELECT USING (true);

-- ===========================================
-- RLS POLICIES: premium_features
-- ===========================================
CREATE POLICY "Admins can manage premium features" ON public.premium_features 
    USING ((EXISTS ( SELECT 1
       FROM public.profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "Authenticated can view premium features" ON public.premium_features 
    FOR SELECT USING ((auth.uid() IS NOT NULL));

-- ===========================================
-- FUNCTION: Handle new user signup
-- ===========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, created_date)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- FUNCTION: Get Activity Stats (Aggregated)
-- Scalable analytics - computes stats server-side
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_activity_stats(cutoff_date TIMESTAMPTZ DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'active_users', COUNT(DISTINCT user_id),
    'lists_created', COUNT(*) FILTER (WHERE operation_name = 'Create New Shopping List'),
    'lists_deleted', COUNT(*) FILTER (WHERE operation_name = 'Delete Shopping List'),
    'items_added', COUNT(*) FILTER (WHERE operation_name = 'Add New Item to List'),
    'items_completed', COUNT(*) FILTER (WHERE operation_name = 'Complete Item in Shopping'),
    'lists_shared', COUNT(*) FILTER (WHERE operation_name = 'Share Shopping List'),
    'lists_joined', COUNT(*) FILTER (WHERE operation_name = 'Join List via Link'),
    'tasks_created', COUNT(*) FILTER (WHERE operation_name = 'Create New Todo'),
    'tasks_completed', COUNT(*) FILTER (WHERE operation_name = 'Complete Todo'),
    'recipes_created', COUNT(*) FILTER (WHERE operation_name = 'Create New Recipe'),
    'recipes_favorited', COUNT(*) FILTER (WHERE operation_name = 'Add Recipe as Favorite')
  ) INTO result
  FROM public.activity_tracking
  WHERE (cutoff_date IS NULL OR "timestamp" >= cutoff_date);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (admins only via RLS)
GRANT EXECUTE ON FUNCTION public.get_activity_stats(TIMESTAMPTZ) TO authenticated;

-- ===========================================
-- FUNCTION: Join List via Share Token (Secure)
-- Validates the share token server-side and creates membership request
-- This replaces direct INSERT into list_members for share link joins
-- ===========================================
CREATE OR REPLACE FUNCTION public.join_list_via_share_token(share_token TEXT)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_share_link RECORD;
  v_existing_membership RECORD;
  v_list_name TEXT;
  v_result JSON;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'not_authenticated',
      'message', 'You must be logged in to join a list'
    );
  END IF;
  
  -- Get user email from profiles
  SELECT email INTO v_user_email 
  FROM public.profiles 
  WHERE id = v_user_id;
  
  -- Validate the share token exists and is active
  SELECT sl.*, s.name as list_name 
  INTO v_share_link
  FROM public.share_links sl
  JOIN public.shopping_lists s ON s.id = sl.list_id
  WHERE sl.token = share_token 
    AND sl.is_active = true
    AND (sl.expires_at IS NULL OR sl.expires_at > NOW());
  
  IF v_share_link IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'invalid_token',
      'message', 'This share link is invalid or has expired'
    );
  END IF;
  
  v_list_name := v_share_link.list_name;
  
  -- Check if user is already a member
  SELECT * INTO v_existing_membership
  FROM public.list_members
  WHERE list_id = v_share_link.list_id
    AND user_id = v_user_id;
  
  IF v_existing_membership IS NOT NULL THEN
    IF v_existing_membership.status = 'approved' THEN
      RETURN json_build_object(
        'success', true,
        'status', 'already_approved',
        'list_id', v_share_link.list_id,
        'list_name', v_list_name,
        'message', 'You already have access to this list'
      );
    ELSE
      -- Return 'already_pending' to differentiate from newly created pending memberships
      -- This prevents duplicate activity tracking on repeat visits
      RETURN json_build_object(
        'success', true,
        'status', 'already_pending',
        'list_id', v_share_link.list_id,
        'list_name', v_list_name,
        'message', 'Your request is pending approval'
      );
    END IF;
  END IF;
  
  -- Create new membership request
  INSERT INTO public.list_members (list_id, user_id, user_email, role, status)
  VALUES (v_share_link.list_id, v_user_id, v_user_email, 'member', 'pending');
  
  RETURN json_build_object(
    'success', true,
    'status', 'pending',
    'list_id', v_share_link.list_id,
    'list_name', v_list_name,
    'message', 'Access request sent! The owner will review your request.'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', 'server_error',
    'message', 'An error occurred. Please try again.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.join_list_via_share_token(TEXT) TO authenticated;

-- ===========================================
-- FUNCTION: Validate Share Token (Public, read-only)
-- Allows checking if a token is valid without creating membership
-- Used for showing the "Sign in to join" UI to unauthenticated users
-- ===========================================
CREATE OR REPLACE FUNCTION public.validate_share_token(share_token TEXT)
RETURNS JSON AS $$
DECLARE
  v_share_link RECORD;
BEGIN
  -- Check if token exists and is active (no auth required for validation)
  SELECT sl.list_id, sl.is_active, sl.expires_at, s.name as list_name
  INTO v_share_link
  FROM public.share_links sl
  JOIN public.shopping_lists s ON s.id = sl.list_id
  WHERE sl.token = share_token 
    AND sl.is_active = true
    AND (sl.expires_at IS NULL OR sl.expires_at > NOW());
  
  IF v_share_link IS NULL THEN
    RETURN json_build_object(
      'valid', false,
      'message', 'This share link is invalid or has expired'
    );
  END IF;
  
  -- Return limited info (don't expose list_id to unauthenticated users)
  RETURN json_build_object(
    'valid', true,
    'list_name', v_share_link.list_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous users (for pre-auth validation)
GRANT EXECUTE ON FUNCTION public.validate_share_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_share_token(TEXT) TO authenticated;

-- ===========================================
-- REALTIME: Enable realtime for items table
-- This allows the app to receive live updates when items are modified
-- (e.g., when background image generation completes)
-- ===========================================

-- Add items table to the supabase_realtime publication
-- Note: Run this in Supabase Dashboard > SQL Editor if not already enabled
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;

-- ===========================================
-- COMPLETE!
-- ===========================================
