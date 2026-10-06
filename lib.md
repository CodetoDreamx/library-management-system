# 📚 Library Management System

A simple, full-stack **Library Management System** designed to make basic library operations easier to manage through a clean and user-friendly web interface.

The application uses **HTML, CSS, JavaScript, Node.js, Express.js, and MongoDB**. It is deployed online so anyone can try the system directly from a browser.

## 🌐 Live Demo

👉 **[Experience the Library Management System](https://library-management-system-4063.onrender.com)**

No installation is required to try the deployed application.

## 💻 Source Code

👉 **[View the project on GitHub](https://github.com/CodetoDreamx/library-management-system)**

Feel free to explore the code, give feedback, or contribute ideas.

## ✨ Features

- 📚 Manage library books
- 👥 Manage library members
- ➕ Add and store records
- ✏️ Update records
- 🗑️ Delete records
- 🔍 View library information
- 💾 Persistent data storage using MongoDB
- 🌐 Fully deployed web application
- 📱 Simple and responsive interface

## 🛠️ Technologies Used

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js

### Database
- MongoDB
- Mongoose

### Deployment
- GitHub – source code and version control
- Render – application hosting
- MongoDB Atlas – cloud database

## 🏗️ Project Structure

```text
library-management-system/
│
├── index.html          # Main frontend page
├── style.css           # Website styling
├── script.js           # Frontend functionality
├── server.js           # Node.js / Express backend
├── package.json        # Project dependencies and scripts
├── package-lock.json   # Dependency lock file
├── .gitignore          # Ignored files and folders
└── README.md           # Project documentation
```

## 🔄 How It Works

```text
User
  ↓
Web Interface
  ↓
JavaScript
  ↓
Express.js API
  ↓
MongoDB
  ↓
Stored Library Data
```

The frontend communicates with the Express.js backend through API requests. The backend handles the application logic and stores/retrieves library data from MongoDB.

## 🚀 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/CodetoDreamx/library-management-system.git
```

### 2. Open the project

```bash
cd library-management-system
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure MongoDB

Create a `.env` file in the project root:

```env
MONGODB_URI=your_mongodb_connection_string
```

**Never commit your `.env` file or database credentials to GitHub.**

### 5. Start the server

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

> The port may depend on the `PORT` configuration used by the application.

## ☁️ Deployment

The live version is deployed using:

- **GitHub** for source-code hosting
- **Render** for the Node.js web service
- **MongoDB Atlas** for cloud database storage

## 🎯 Purpose

This project was created as a practical full-stack development project to understand:

- Frontend development
- Backend API development
- Database integration
- CRUD operations
- Git and GitHub
- Cloud deployment
- Connecting a deployed application to a cloud database

## 🤝 Feedback & Contributions

Have an idea to improve the project?

You can:

1. Try the live application.
2. Explore the source code.
3. Report an issue.
4. Suggest improvements.
5. Fork the repository and experiment with your own version.

⭐ If you find the project useful, consider giving the repository a **star** on GitHub!

## 👨‍💻 Project

**Library Management System**

Built as a learning and development project by **CodetoDreamx**.

---

### 🔗 Quick Links

- 🌐 **[Live Demo](https://library-management-system-4063.onrender.com)**
- 💻 **[GitHub Repository](https://github.com/CodetoDreamx/library-management-system)**
