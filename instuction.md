# Electricity Bill Management System (Next.js + MySQL)

## Technology Stack
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn UI
- Prisma ORM
- MySQL (phpMyAdmin / XAMPP)
- NextAuth / JWT
- Razorpay Payment Gateway
- Nodemailer
- PDFKit

## Features

### Admin
- Login / Logout
- Dashboard
- Add/Edit/Delete Customers
- Manage Connections
- Generate Electricity Bills
- Send Email Notifications
- View Payments
- Reports & Exports

### Customer
- Login
- View Current Bill
- Download PDF Bill
- View Payment History
- Pay Online via Razorpay
- Download Receipts

## Database
MySQL database managed through phpMyAdmin.

DATABASE_URL="mysql://root:@localhost:3306/electricity_management"

## Main Modules
1. Authentication
2. Customer Management
3. Connection Management
4. Meter Reading
5. Billing
6. Payment Gateway
7. Email Notifications
8. Reports

## Project Structure

electricity-management/
├── app/
├── components/
├── prisma/
├── lib/
├── public/
└── api/

## Payment Flow

Customer → Razorpay → Verify Payment → Update Bill Status → Generate Receipt → Send Email

## Security
- JWT Authentication
- Password Hashing
- Role Based Access
- Input Validation
- Rate Limiting
- Audit Logs

## Deliverables
- Next.js Frontend
- Next.js API Backend
- MySQL Database
- Prisma Schema
- Razorpay Integration
- PDF Generation
- Email Notifications
- Admin Portal
- Customer Portal
