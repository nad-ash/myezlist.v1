import Layout from "./Layout.jsx";

import Home from "./Home";

import ListView from "./ListView";

import ShoppingMode from "./ShoppingMode";

import Analytics from "./Analytics";

import ImportList from "./ImportList";

import JoinListViaLink from "./JoinListViaLink";

import JoinFamily from "./JoinFamily";

import MasterItemList from "./MasterItemList";

import Admin from "./Admin";

import Todos from "./Todos";

import Recipe from "./Recipe";

import MasterRecipeList from "./MasterRecipeList";

import RecipeDetail from "./RecipeDetail";

import PopularRecipes from "./PopularRecipes";

import FavoriteRecipes from "./FavoriteRecipes";

import MyRecipes from "./MyRecipes";

import ShoppingModeActive from "./ShoppingModeActive";

import Settings from "./Settings";

import PremiumFeaturesAdmin from "./PremiumFeaturesAdmin";

import CreditHistory from "./CreditHistory";

import ManageSubscriptionTiers from "./ManageSubscriptionTiers";

import Landing from "./Landing";

import ManageLists from "./ManageLists";

import CacheManagement from "./CacheManagement";

import AdvancedActivityTracking from "./AdvancedActivityTracking";

import UserManagement from "./UserManagement";

import PrivacyPolicy from "./PrivacyPolicy";

import Terms from "./Terms";

import RefundPolicy from "./RefundPolicy";

import Login from "./Login";

import AuthCallback from "./AuthCallback";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Home: Home,
    
    ListView: ListView,
    
    ShoppingMode: ShoppingMode,
    
    Analytics: Analytics,
    
    ImportList: ImportList,
    
    JoinListViaLink: JoinListViaLink,
    
    JoinFamily: JoinFamily,
    
    MasterItemList: MasterItemList,
    
    Admin: Admin,
    
    Todos: Todos,
    
    Recipe: Recipe,
    
    MasterRecipeList: MasterRecipeList,
    
    RecipeDetail: RecipeDetail,
    
    PopularRecipes: PopularRecipes,
    
    FavoriteRecipes: FavoriteRecipes,
    
    MyRecipes: MyRecipes,
    
    ShoppingModeActive: ShoppingModeActive,
    
    Settings: Settings,
    
    PremiumFeaturesAdmin: PremiumFeaturesAdmin,
    
    CreditHistory: CreditHistory,
    
    ManageSubscriptionTiers: ManageSubscriptionTiers,
    
    Landing: Landing,
    
    ManageLists: ManageLists,
    
    CacheManagement: CacheManagement,
    
    AdvancedActivityTracking: AdvancedActivityTracking,
    
    UserManagement: UserManagement,
    
    PrivacyPolicy: PrivacyPolicy,
    
    Terms: Terms,
    
    RefundPolicy: RefundPolicy,
    
    Login: Login,
    
    AuthCallback: AuthCallback,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Home />} />
                
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/ListView" element={<ListView />} />
                
                <Route path="/ShoppingMode" element={<ShoppingMode />} />
                
                <Route path="/Analytics" element={<Analytics />} />
                
                <Route path="/ImportList" element={<ImportList />} />
                
                <Route path="/JoinListViaLink" element={<JoinListViaLink />} />
                
                <Route path="/join-family" element={<JoinFamily />} />
                
                <Route path="/JoinFamily" element={<JoinFamily />} />
                
                <Route path="/MasterItemList" element={<MasterItemList />} />
                
                <Route path="/Admin" element={<Admin />} />
                
                <Route path="/Todos" element={<Todos />} />
                
                <Route path="/Recipe" element={<Recipe />} />
                
                <Route path="/MasterRecipeList" element={<MasterRecipeList />} />
                
                <Route path="/RecipeDetail" element={<RecipeDetail />} />
                
                <Route path="/PopularRecipes" element={<PopularRecipes />} />
                
                <Route path="/FavoriteRecipes" element={<FavoriteRecipes />} />
                
                <Route path="/MyRecipes" element={<MyRecipes />} />
                
                <Route path="/ShoppingModeActive" element={<ShoppingModeActive />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/PremiumFeaturesAdmin" element={<PremiumFeaturesAdmin />} />
                
                <Route path="/CreditHistory" element={<CreditHistory />} />
                
                <Route path="/ManageSubscriptionTiers" element={<ManageSubscriptionTiers />} />
                
                <Route path="/Landing" element={<Landing />} />
                
                <Route path="/ManageLists" element={<ManageLists />} />
                
                <Route path="/CacheManagement" element={<CacheManagement />} />
                
                <Route path="/AdvancedActivityTracking" element={<AdvancedActivityTracking />} />
                
                <Route path="/UserManagement" element={<UserManagement />} />
                
                <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
                
                <Route path="/Terms" element={<Terms />} />
                
                <Route path="/RefundPolicy" element={<RefundPolicy />} />
                
                <Route path="/Login" element={<Login />} />
                
                <Route path="/login" element={<Login />} />
                
                <Route path="/auth/callback" element={<AuthCallback />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}