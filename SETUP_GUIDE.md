# ShareCircle Project Setup Guide

This guide provides step-by-step instructions to set up the ShareCircle frontend and backend on your local machine.

## Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (Download the LTS version)
- [MongoDB](https://www.mongodb.com/try/download/community) (For local database) or a MongoDB Atlas account
- [Git](https://git-scm.com/)

## 1. Clone the Repository

Open your terminal and run the following command to clone the project:

```bash
git clone <your-repository-url>
cd ShareCircle
```

## 2. Backend Setup

### Step 2.1: Install Dependencies
Navigate to the backend directory and install the required packages:

```bash
cd backend
npm install
```

### Step 2.2: Configure Environment Variables
Create a `.env` file in the `backend` directory:

```bash
# On Windows (PowerShell)
New-Item -Path .env -ItemType File

# On Mac/Linux
touch .env
```

Open the `.env` file and add the following keys (ask the project owner for the values):

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/sharecircle  # Or your MongoDB Atlas URI
JWT_SECRET=your_super_secret_key_here
```

### Step 2.3: Start the Backend Server
Run the following command to start the server:

```bash
npm run dev
```

You should see:
```
🚀 Starting HeartMap backend...
✅ Database connected successfully
🔥 Server running at http://0.0.0.0:5000
```

---

## 3. Frontend Setup

### Step 3.1: Install Dependencies
Open a new terminal window, navigate to the `frontend` directory, and install dependencies:

```bash
cd frontend
npm install
```

### Step 3.2: Configure API URL
If you are running the backend locally:
- **For Web**: The default `http://localhost:5000/api` will work.
- **For Android Emulator**: You might need to use `http://10.0.2.2:5000/api`.
- **For Physical Device**: Use your computer's IP address (e.g., `http://192.168.1.5:5000/api`).

Check `frontend/src/utils/constants.js` to ensure the `API_URL` is set correctly for your environment.

### Step 3.3: Start the Frontend
Run the app using Expo:

```bash
npx expo start
```

- Press `w` to run on Web.
- Press `a` to run on Android Emulator.
- Scan the QR code with the **Expo Go** app to run on a physical device.
