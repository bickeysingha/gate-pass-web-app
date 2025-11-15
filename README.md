# 🚪 Smart Gate Pass System (Firebase)

A modern Gate Pass Management Web App built with **JavaScript + Firebase Auth + Firestore**.  
Students can request gate pass approvals, & Admins can approve / reject with real-time updates.

## ✨ Features

| User Type | Features |
|----------|----------|
| Student | Signup, Login, Request Gate Pass, View Pass Status (Pending / Approved / Rejected) |
| Admin | Login, View all pass requests, Approve / Reject instantly, Firestore based role system |

## 🔐 Authentication

- Email / Password Login (Student + Admin)
- Admin verified through Firestore collection `admins`
- Students store standard + uid

## 🏗️ Tech Stack

- Firebase v9 Modular
- Firestore Database
- Firebase Authentication
- Vanilla HTML + CSS + JS (No Framework)

## 🗄️ Firestore Structure

| Collection | Example Doc ID | Purpose |
|------------|----------------|---------|
| admins | singhabickey500@gmail.com | Stores admin roles |
| gatepasses | auto-id doc | Stores all gate pass requests |
| students (optional) | uid | Store student profile fields |

Example admin document:

```json
{
  "role": "admin"
}
