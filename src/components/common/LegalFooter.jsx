import React from "react";
import { createPageUrl } from "@/utils";

export default function LegalFooter() {
  return (
    <footer className="bg-slate-900 dark:bg-slate-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e49376f2948d5caa147758/52890d187_MyEZList_Icon_512x512.png"
              alt="MyEZList"
              className="w-8 h-8 object-contain"
            />
            <span className="text-slate-400 text-sm">
              © 2025 MyEZList. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a 
              href={createPageUrl("PrivacyPolicy")} 
              className="text-slate-400 hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
            <span className="text-slate-600">|</span>
            <a 
              href={createPageUrl("Terms")} 
              className="text-slate-400 hover:text-white transition-colors"
            >
              Terms & Conditions
            </a>
            <span className="text-slate-600">|</span>
            <a 
              href={createPageUrl("RefundPolicy")} 
              className="text-slate-400 hover:text-white transition-colors"
            >
              Refund Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}