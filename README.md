# MXTrade Ecommerce Platform

This starter project is built as a clean ecommerce MVP using **Next.js**, **Tailwind CSS**, **Firebase**, and a placeholder for **PayFast** payment integration.

## Architecture

- Frontend: React + Next.js pages + API routes
- Styling: Tailwind CSS
- Auth: Firebase Authentication
- Database: Firestore
- File storage: Firebase Storage
- Payment provider: PayFast / Fayfast placeholder

## Key pages

- Home / Shop landing page
- Product listing and product detail pages
- Seller dashboard and product submission form
- Admin dashboard for review and approval
- About and FAQ
- Login / register

## Firebase data model

- `users` - accounts, roles, and profile metadata for customers, sellers, and admins
- `productSubmissions` - seller-submitted items pending admin review
- `products` - approved live products shown to customers
- `orders` - order records and payment metadata (future)
- `categories` - product categories and tags (future)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a Firebase project and set environment variables in `.env.local`:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Notes

- This scaffold is intentionally simple for a clean MVP.
- The `pages/api/payfast` routes are placeholders for gateway-specific implementation.
- Role-based access is stored in `users.role` and enforced in pages using auth state.
- Admin accounts should be created manually in firebase console or assigned `role: 'admin'` in the `users` collection.
