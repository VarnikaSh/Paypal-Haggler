# PayPal Haggler
### AI-Powered Agent-to-Agent Negotiation and Commerce

PayPal Haggler is an AI-powered commerce platform where autonomous buyer and seller agents negotiate prices on behalf of humans, while a third AI referee evaluates the resulting agreement.

Once a deal is reached, both participants must approve the negotiated price before payment is processed through PayPal Sandbox.

Our vision is to explore the future of agentic commerce, where AI agents can negotiate and facilitate transactions while humans retain control over financial decisions.

---

## 1. Problem Statement

Traditional online commerce generally requires buyers and sellers to negotiate prices manually. This process can be time-consuming, inefficient and difficult to scale.

PayPal Haggler explores how autonomous AI agents can simplify this process by negotiating within predefined financial boundaries.

## 2. Our Solution

PayPal Haggler introduces a three-agent negotiation system:

**Buyer Agent**
- Represents the buyer.
- Operates within a predefined maximum budget.
- Evaluates seller offers.
- Generates strategic counteroffers.

**Seller Agent**
- Represents the seller.
- Protects the seller's minimum acceptable price.
- Evaluates buyer offers.
- Negotiates to maximize the seller's outcome.

**AI Referee**
- Evaluates the negotiation transcript.
- Assesses the proposed agreement.
- Generates a deal assessment and receipt.

After negotiation, both participants must approve the transaction before PayPal checkout becomes available.

## 3. Key Features

- Autonomous buyer and seller negotiation.
- Private financial limits for each agent.
- AI-generated offers and counteroffers.
- AI referee and deal evaluation.
- Fair Deal Score.
- Buyer savings and seller margin analysis.
- Buyer and seller approval workflow.
- PayPal Orders API v2 integration.
- PayPal Sandbox checkout and payment capture.
- Local AI inference using Ollama.

## 4. Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| AI Model | Llama 3.2 (3B) |
| AI Runtime | Ollama |
| Payment Integration | PayPal Orders API v2 |
| Payment Environment | PayPal Sandbox |
| Security Middleware | Helmet, CORS, Express Rate Limit |

## 5. System Architecture

The application follows this workflow:

1. Buyer and seller enter their financial constraints.
2. The backend sends negotiation prompts to the local AI model.
3. Buyer and seller agents exchange offers and counteroffers.
4. The negotiation engine evaluates the offers and determines an outcome.
5. The referee evaluates an eligible agreement.
6. Both participants approve the proposed transaction.
7. The backend creates a PayPal order.
8. PayPal Sandbox processes the payment.
9. The application verifies payment capture and generates a transaction receipt.

## 6. Project Structure

```text
paypal-haggler/
│
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── server/
│   ├── claude.js
│   ├── negotiation.js
│   ├── referee.js
│   ├── security.js
│   ├── paypal.js
│   └── server.js
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── LICENSE
└── README.md
```

## 7. Prerequisites

Before running the project, install:

- Node.js 20 or later.
- npm.
- Ollama.
- A PayPal Developer account with Sandbox application credentials.

## 8. Installation and Setup

### Step 1: Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd paypal-haggler
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Install and download the AI model

Install Ollama from:

https://ollama.com/

Download the model:

```bash
ollama pull llama3.2:3b
```

Verify the model:

```bash
ollama list
```

Test the model:

```bash
ollama run llama3.2:3b
```

Ollama should be running locally before starting the application.

### Step 4: Configure environment variables

Create a `.env` file in the project root.

Add:

```env
PORT=3000

OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

PAYPAL_CLIENT_ID=YOUR_SANDBOX_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_SANDBOX_CLIENT_SECRET

PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

Replace the PayPal placeholders with your own Sandbox credentials.

Never commit your `.env` file or expose your PayPal Client Secret.

### Step 5: Configure PayPal Sandbox

1. Visit the PayPal Developer Dashboard.
2. Create or select a Sandbox application.
3. Obtain your Sandbox Client ID and Client Secret.
4. Add the credentials to `.env`.
5. Create Sandbox Personal and Business test accounts for payment testing.

Developer Dashboard:

https://developer.paypal.com/dashboard/

### Step 6: Start the application

```bash
npm start
```

Open your browser:

```text
http://localhost:3000
```

## 9. How to Use PayPal Haggler

1. Enter the product or service name.
2. Enter the original listing price.
3. Define the seller's minimum acceptable price.
4. Define the buyer's maximum budget.
5. Select the buyer's negotiation strategy.
6. Add optional seller conditions.
7. Start the negotiation.
8. Review the negotiation transcript and deal assessment.
9. Approve the proposed transaction as buyer and seller.
10. Complete the payment using PayPal Sandbox.

## 10. AI Implementation

PayPal Haggler uses Llama 3.2 through Ollama for local AI inference.

The model generates structured negotiation responses containing:

- Negotiation message.
- Proposed offer.
- Negotiation action.

The backend validates the responses and enforces financial constraints before accepting offers.

A separate referee component evaluates eligible agreements.

Local inference allows the prototype to run without paid external AI API calls.

## 11. Payment Integration

PayPal Haggler integrates PayPal Orders API v2.

The payment workflow includes:

- Creating a PayPal order after participant approvals.
- Redirecting the buyer to PayPal Sandbox checkout.
- Capturing the approved order.
- Verifying the captured amount and transaction details.
- Generating a transaction receipt.

All payment testing takes place in the PayPal Sandbox environment.

No real money is transferred during Sandbox testing.

## 12. Security Considerations and Current Limitations

This project is a hackathon prototype and is not intended for production financial transactions.

Current limitations include:

- Buyer and seller approval actions currently share the same browser interface.
- Deal information is stored in server memory and is not persistent.
- Production deployment would require stronger authentication, independent participant sessions and persistent storage.
- Payment processing requires additional production-grade idempotency and recovery controls.
- The Fair Deal Score is a mathematical assessment and should not be interpreted as an objective guarantee of fairness.

## 13. Future Improvements

- Independent buyer and seller sessions.
- Persistent database integration.
- More advanced negotiation strategies.
- Improved referee evaluation.
- Negotiation analytics dashboard.
- Production-grade authentication and transaction security.
- Hosted deployment for public demonstrations.

## 14. License

This project is licensed under the MIT License. See the LICENSE file for details.

---

### Built for the PayPal AI Hackathon

**PayPal Haggler — Bringing Agentic AI to Digital Commerce.**