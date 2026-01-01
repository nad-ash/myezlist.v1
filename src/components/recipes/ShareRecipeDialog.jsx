import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Link2,
  Check,
  Share2,
  MessageCircle,
  Facebook,
  Twitter,
  Mail,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Pinterest icon (not in lucide)
const PinterestIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
);

export default function ShareRecipeDialog({ open, onOpenChange, recipe, onShare }) {
  const [copied, setCopied] = useState(false);
  
  // Use the short share URL format that goes through our API for proper OG tags
  // This URL will serve dynamic meta tags for social crawlers, then redirect users to the SPA
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = recipe?.id ? `${baseUrl}/r/${recipe.id}` : (typeof window !== 'undefined' ? window.location.href : '');
  
  const shareTitle = recipe?.full_title || 'Check out this recipe';
  const shareText = `${shareTitle} - Check out this delicious recipe on MyEZList!`;
  const shareImage = recipe?.photo_url || '';

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShare?.('copy_link');
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShare?.('copy_link');
    }
  };

  // Native share API (mobile)
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        onShare?.('native_share');
        onOpenChange(false);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    }
  };

  // WhatsApp share - cleaner format without raw image URL
  const handleWhatsAppShare = () => {
    // Build a clean, engaging message
    // Note: WhatsApp will auto-generate a link preview with image from Open Graph tags
    let message = `*${shareTitle}*\n\n`;
    
    // Add recipe details if available
    const details = [];
    if (recipe?.cooking_time) details.push(`Time: ${recipe.cooking_time}`);
    if (recipe?.servings) details.push(`Servings: ${recipe.servings}`);
    if (recipe?.cuisine) details.push(`Cuisine: ${recipe.cuisine}`);
    
    if (details.length > 0) {
      message += details.join(' | ') + '\n\n';
    }
    
    message += `I found this delicious recipe and thought you'd love it!\n\n`;
    message += `${shareUrl}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    onShare?.('whatsapp');
  };

  // Facebook share
  const handleFacebookShare = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'width=600,height=400'
    );
    onShare?.('facebook');
  };

  // Twitter/X share
  const handleTwitterShare = () => {
    // Build tweet with recipe details
    let tweetText = `${shareTitle}`;
    if (recipe?.cuisine) tweetText += ` (${recipe.cuisine})`;
    tweetText += `\n\nFound this amazing recipe on @MyEZList!`;
    
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'width=600,height=400'
    );
    onShare?.('twitter');
  };

  // Pinterest share
  const handlePinterestShare = () => {
    const pinUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&media=${encodeURIComponent(shareImage)}&description=${encodeURIComponent(shareText)}`;
    window.open(pinUrl, '_blank', 'width=600,height=400');
    onShare?.('pinterest');
  };

  // Email share
  const handleEmailShare = () => {
    const subject = `Check out this recipe: ${shareTitle}`;
    
    // Build a detailed email body
    let body = `Hey!\n\nI found this amazing recipe and thought you'd love it:\n\n`;
    body += `${shareTitle}\n`;
    
    // Add recipe details
    const details = [];
    if (recipe?.cooking_time) details.push(`Cooking Time: ${recipe.cooking_time}`);
    if (recipe?.servings) details.push(`Servings: ${recipe.servings}`);
    if (recipe?.cuisine) details.push(`Cuisine: ${recipe.cuisine}`);
    if (recipe?.calories_per_serving) details.push(`Calories: ${recipe.calories_per_serving}`);
    
    if (details.length > 0) {
      body += details.join('\n') + '\n';
    }
    
    body += `\nView the full recipe here:\n${shareUrl}\n\n`;
    body += `Happy cooking!`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    onShare?.('email');
  };

  const shareOptions = [
    {
      id: 'copy',
      label: copied ? 'Copied!' : 'Copy Link',
      icon: copied ? Check : Link2,
      onClick: handleCopyLink,
      className: copied 
        ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400' 
        : 'hover:bg-slate-50 dark:hover:bg-slate-800',
      highlight: true,
    },
    ...(navigator.share ? [{
      id: 'native',
      label: 'More Options',
      icon: ExternalLink,
      onClick: handleNativeShare,
      className: 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    }] : []),
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: MessageCircle,
      onClick: handleWhatsAppShare,
      className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400',
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: Facebook,
      onClick: handleFacebookShare,
      className: 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'twitter',
      label: 'X (Twitter)',
      icon: Twitter,
      onClick: handleTwitterShare,
      className: 'hover:bg-slate-100 dark:hover:bg-slate-700',
    },
    {
      id: 'pinterest',
      label: 'Pinterest',
      icon: PinterestIcon,
      onClick: handlePinterestShare,
      className: 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400',
      show: !!shareImage, // Only show Pinterest if there's an image
    },
    {
      id: 'email',
      label: 'Email',
      icon: Mail,
      onClick: handleEmailShare,
      className: 'hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    },
  ].filter(option => option.show !== false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md !bg-white dark:!bg-slate-900 dark:!border-slate-700 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 !text-slate-800 dark:!text-white">
            <Share2 className="w-5 h-5" />
            Share Recipe
          </DialogTitle>
          <DialogDescription className="!text-slate-600 dark:!text-slate-400 break-words">
            Share "<span className="font-medium break-all">{recipe?.full_title}</span>" with friends and family
          </DialogDescription>
        </DialogHeader>

        {/* Recipe Preview Card */}
        {recipe && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            {recipe.photo_url && (
              <img 
                src={recipe.photo_url} 
                alt={recipe.full_title}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                {recipe.full_title}
              </h4>
              {recipe.cook_time && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ⏱️ {recipe.cook_time}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Copy Link Input */}
        <div className="flex items-center gap-2">
          <Input 
            value={shareUrl} 
            readOnly 
            className="flex-1 text-sm !bg-slate-50 dark:!bg-slate-800 !text-slate-600 dark:!text-slate-300"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className={cn(
              "flex-shrink-0 transition-all",
              copied && "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400"
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
          </Button>
        </div>

        {/* Share Options Grid */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          {shareOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Button
                key={option.id}
                variant="outline"
                onClick={option.onClick}
                className={cn(
                  "flex flex-col items-center gap-1.5 h-auto py-3 transition-all",
                  "border-slate-200 dark:border-slate-700",
                  option.className
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{option.label}</span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
