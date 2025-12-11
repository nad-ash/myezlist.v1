import React, { useState, useEffect } from "react";
import { ShareLink } from "@/api/entities";
import { ShoppingList } from "@/api/entities";
import { ListMember } from "@/api/entities";
import { User, ActivityTracking } from "@/api/entities";
import { OPERATIONS, PAGES } from "@/utils/trackingContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import LegalFooter from "@/components/common/LegalFooter";

export default function JoinListViaLink() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [listName, setListName] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  useEffect(() => {
    if (token) {
      processJoin();
    } else {
      setStatus('error');
      setMessage('No token found');
    }
  }, []);

  const processJoin = async () => {
    try {
      setMessage('Checking authentication...');
      const currentUser = await User.me();

      setMessage('Validating share link...');
      const shareLinks = await ShareLink.filter({ token, is_active: true });

      if (shareLinks.length === 0) {
        setStatus('error');
        setMessage('Invalid or expired share link');
        return;
      }

      const targetListId = shareLinks[0].list_id;

      setMessage('Loading list...');
      const allLists = await ShoppingList.list();
      const list = allLists.find(l => l.id === targetListId);

      if (!list) {
        setStatus('error');
        setMessage('List not found');
        return;
      }

      setListName(list.name);

      setMessage('Checking membership...');
      const memberships = await ListMember.filter({
        list_id: targetListId,
        user_id: currentUser.id
      });

      if (memberships.length > 0) {
        const membership = memberships[0];
        
        if (membership.status === 'approved') {
          setStatus('already_approved');
          setMessage(`You already have access to "${list.name}"`);
          setTimeout(() => navigate(createPageUrl(`ListView?listId=${targetListId}`)), 2000);
        } else {
          setStatus('pending');
          setMessage(`Your request to join "${list.name}" is pending approval from the owner.`);
        }
        return;
      }

      setMessage('Requesting access...');
      await ListMember.create({
        list_id: targetListId,
        user_id: currentUser.id,
        user_email: currentUser.email,
        role: 'member',
        status: 'pending'
      });

      // Track activity using standardized operation
      await ActivityTracking.create({
        operation_type: 'CREATE',
        page: PAGES.JOIN_LIST,
        operation_name: OPERATIONS.LIST_MEMBER.JOIN,
        description: `User joined shopping list "${list.name}" via share link`,
        user_id: currentUser.id,
        timestamp: new Date().toISOString()
      });

      setStatus('pending');
      setMessage(`Access request sent! The owner of "${list.name}" will review your request.`);

    } catch (error) {
      console.error("Error:", error);
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Processing...</h1>
              <p className="text-slate-600">{message}</p>
            </>
          )}

          {status === 'pending' && (
            <>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-10 h-10 text-yellow-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Pending Approval</h1>
              <p className="text-slate-600 mb-6">{message}</p>
              <p className="text-sm text-slate-500 mb-4">
                You'll be able to access the list once the owner approves your request.
              </p>
              <Button onClick={() => navigate(createPageUrl("Home"))} variant="outline">
                Go to Home
              </Button>
            </>
          )}

          {status === 'already_approved' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Access Granted</h1>
              <p className="text-slate-600">{message}</p>
              <p className="text-sm text-slate-500 mt-2">Redirecting...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Error</h1>
              <p className="text-slate-600 mb-6">{message}</p>
              <Button onClick={() => navigate(createPageUrl("Home"))} variant="outline">
                Go to Home
              </Button>
            </>
          )}
        </div>
      </div>
      </div>
      
      <LegalFooter />
    </div>
  );
}