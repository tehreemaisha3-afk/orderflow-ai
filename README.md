# OrderFlow AI

An AI-powered order management web application that helps small businesses automate customer order processing from WhatsApp messages. The application extracts structured order information using AI, manages customers and products, and provides an efficient dashboard for tracking business operations.

---

## Live Application

**Application:** https://chatorder-aid.lovable.app 

---

## GitHub Repository

**Repository:** https://github.com/tehreemaisha3-afk/orderflow-ai

---

## Problem Statement

Many small businesses receive customer orders through WhatsApp and manually transfer the information into spreadsheets or notebooks. This process is time-consuming, repetitive, and prone to human error.

OrderFlow AI solves this problem by using Artificial Intelligence to automatically understand customer messages, extract order details, and organize them into a structured order management system.

---

## Features

- AI-powered WhatsApp order processing
- Automatic extraction of customer order details
- Customer management
- Product management
- Order tracking dashboard
- Inventory management
- Clean and responsive user interface
- Secure cloud database
- Real-time business data management

---

## AI Functionality

The application uses the OpenAI API to analyse customer WhatsApp messages and convert natural language into structured order information.

The AI can identify:

- Customer information
- Ordered products
- Quantities
- Special instructions
- Order details

This significantly reduces manual data entry and improves business efficiency.

---

## AI Instructions / System Prompt

The AI assistant is instructed to analyse incoming customer order messages, identify important order information, organise the extracted data into a structured format, and assist users in managing customer orders accurately and efficiently.

---

## Technologies Used

- React
- TypeScript
- Tailwind CSS
- Supabase
- OpenAI API
- Twilio WhatsApp Sandbox
- Lovable
- GitHub

---

## Screenshots

### Home Page

![Home Page](screenshots/home-page.png)

---

### Dashboard

![Dashboard](screenshots/dashboard.png)

---

### AI Assistant – Conversation (Part 1)

![AI Assistant Conversation Part 1](screenshots/ai-assistant-1.png)

---

### AI Assistant – Conversation (Part 2)

![AI Assistant Conversation Part 2](screenshots/ai-assistant-2.png)

---

### Orders

![Orders](screenshots/orders.png)

---

### Customers

![Customers](screenshots/customers.png)

---

### Products

![Products](screenshots/products.png)

---

## How to Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/tehreemaisha3-afk/orderflow-ai.git
```

### 2. Navigate to the project folder

```bash
cd orderflow-ai
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file and add the required environment variables.

### 5. Start the development server

```bash
npm run dev
```

---

## Environment Variables

The application requires the following environment variables:

- OpenAI API Key
- Supabase URL
- Supabase Anon Key
- Twilio Account SID
- Twilio Auth Token
- Twilio WhatsApp Number

---

## Future Improvements

- WhatsApp Business API integration
- Invoice generation
- Sales analytics dashboard
- Email notifications
- Multi-user authentication
- Advanced inventory reporting
- Customer purchase history
- Order status notifications

---

## Author

**Tehreem Aisha**

Developed as the final project for an AI Application Development course.

---

## License

This project is developed for educational and portfolio purposes.
