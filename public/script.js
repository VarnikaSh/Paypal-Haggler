"use strict";

let currentDeal = null;
let paypalSdkLoaded = false;
let paypalButtonsRendered = false;

const dealForm = document.getElementById("dealForm");
const startButton = document.getElementById("startButton");

const conversation = document.getElementById("conversation");
const turnCounter = document.getElementById("turnCounter");

const sellerStatus = document.getElementById("sellerStatus");
const buyerStatus = document.getElementById("buyerStatus");
const liveIndicator = document.getElementById("liveIndicator");

const resultPanel = document.getElementById("resultPanel");
const resultTitle = document.getElementById("resultTitle");
const finalPrice = document.getElementById("finalPrice");
const refereeReceipt = document.getElementById("refereeReceipt");

const fairnessSection = document.getElementById("fairnessSection");
const fairnessScore = document.getElementById("fairnessScore");
const buyerSavings = document.getElementById("buyerSavings");
const sellerMargin = document.getElementById("sellerMargin");

const approvalSection = document.getElementById("approvalSection");
const sellerApprove = document.getElementById("sellerApprove");
const buyerApprove = document.getElementById("buyerApprove");
const approvalStatus = document.getElementById("approvalStatus");

const paymentSection = document.getElementById("paymentSection");
const paymentAmount = document.getElementById("paymentAmount");
const paymentStatus = document.getElementById("paymentStatus");

const receiptSection = document.getElementById("receiptSection");
const receiptDetails = document.getElementById("receiptDetails");

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(amount));
}


function showElement(element) {
    if (element) {
        element.hidden = false;
    }
}


function hideElement(element) {
    if (element) {
        element.hidden = true;
    }
}


function setStatus(element, message) {
    if (element) {
        element.textContent = message;
    }
}


function setButtonLoading(button, loading, loadingText = "Please wait...") {
    if (!button) return;

    if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
        button.disabled = true;
    } else {
        button.textContent =
            button.dataset.originalText || button.textContent;

        button.disabled = false;
    }
}


async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.error || `Request failed with status ${response.status}`
        );
    }

    return data;
}

function clearConversation() {
    conversation.replaceChildren();
}


function addMessage(entry) {
    const message = document.createElement("div");

    const role = entry.role === "seller" ? "seller" : "buyer";

    message.className = `message ${role}`;

    const header = document.createElement("div");
    header.className = "message-header";

    header.textContent =
        role === "seller" ? "Seller Agent" : "Buyer Agent";

    const body = document.createElement("p");
    body.textContent = entry.message || "";

    message.appendChild(header);
    message.appendChild(body);

    if (
        entry.offer !== null &&
        entry.offer !== undefined &&
        Number.isFinite(Number(entry.offer))
    ) {
        const offer = document.createElement("div");
        offer.className = "message-offer";

        offer.textContent = `Offer: ${formatCurrency(entry.offer)}`;

        message.appendChild(offer);
    }

    conversation.appendChild(message);

    conversation.scrollTop = conversation.scrollHeight;
}


function displayConversation(entries) {
    clearConversation();

    if (!Array.isArray(entries)) return;

    entries.forEach(addMessage);

    setStatus(turnCounter, `${entries.length} turns`);
}

function updateAgentStatus(outcome) {
    setStatus(sellerStatus, "Negotiation complete");
    setStatus(buyerStatus, "Negotiation complete");

    setStatus(liveIndicator, "Session completed");

    if (outcome === "deal") {
        setStatus(sellerStatus, "Agreement reached");
        setStatus(buyerStatus, "Agreement reached");
    } else {
        setStatus(sellerStatus, "Negotiation ended");
        setStatus(buyerStatus, "Negotiation ended");
    }
}

function resetWorkspace() {
    currentDeal = null;

    hideElement(resultPanel);
    hideElement(fairnessSection);
    hideElement(approvalSection);
    hideElement(paymentSection);
    hideElement(receiptSection);

    clearConversation();

    setStatus(turnCounter, "0 turns");
    setStatus(sellerStatus, "Waiting");
    setStatus(buyerStatus, "Waiting");
    setStatus(liveIndicator, "Ready");

    sellerApprove.disabled = false;
    buyerApprove.disabled = false;

    sellerApprove.textContent = "Approve as Seller";
    buyerApprove.textContent = "Approve as Buyer";

    paypalButtonsRendered = false;

    const paypalContainer =
        document.getElementById("paypal-button-container");

    if (paypalContainer) {
        paypalContainer.replaceChildren();
    }
}

dealForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    resetWorkspace();

    setButtonLoading(startButton, true, "Negotiating...");

    setStatus(liveIndicator, "AI agents negotiating");

    const formData = {
        item: document.getElementById("item").value.trim(),

        listPrice: Number(
            document.getElementById("listPrice").value
        ),

        sellerMin: Number(
            document.getElementById("sellerMin").value
        ),

        buyerMax: Number(
            document.getElementById("buyerMax").value
        ),

        buyerStyle: document.getElementById("buyerStyle").value,

        sellerRules: document.getElementById("sellerRules").value.trim()
    };

    try {
        const result = await apiRequest("/api/negotiate", {
            method: "POST",
            body: JSON.stringify(formData)
        });

        displayConversation(result.conversation || []);

        updateAgentStatus(result.outcome);

        if (result.outcome !== "deal") {
            showElement(resultPanel);

            resultTitle.textContent =
                "No agreement reached";

            finalPrice.textContent =
                "The agents could not reach an acceptable agreement.";

            return;
        }

        currentDeal = {
            id: result.dealId,

            sellerToken: result.credentials?.sellerToken,
            buyerToken: result.credentials?.buyerToken,

            price: Number(result.price),

            approvals: {
                seller: false,
                buyer: false
            }
        };

        displayDealResult(result);

    } catch (error) {
        console.error("Negotiation error:", error);

        setStatus(
            liveIndicator,
            error.message || "Negotiation failed."
        );

        alert(error.message || "Unable to start negotiation.");

    } finally {
        setButtonLoading(startButton, false);
    }
});

function displayDealResult(result) {
    showElement(resultPanel);

    resultTitle.textContent = "Agreement reached";

    finalPrice.textContent = formatCurrency(result.price);

    if (result.receipt) {
        refereeReceipt.textContent = result.receipt;
    } else {
        refereeReceipt.textContent =
            "The referee did not provide a receipt.";
    }

    if (result.fairnessScore !== undefined) {
        showElement(fairnessSection);

        fairnessScore.textContent =
            `${Math.round(result.fairnessScore)}/100`;
    }

    if (result.buyerSavings !== undefined) {
        buyerSavings.textContent =
            formatCurrency(result.buyerSavings);
    }

    if (result.sellerMargin !== undefined) {
        sellerMargin.textContent =
            formatCurrency(result.sellerMargin);
    }

    showElement(approvalSection);

    setStatus(
        approvalStatus,
        "Both participants must approve the negotiated price."
    );

    sellerApprove.disabled = false;
    buyerApprove.disabled = false;
}

async function approveDeal(side) {
    if (!currentDeal) {
        alert("No active deal found.");
        return;
    }

    const button =
        side === "seller" ? sellerApprove : buyerApprove;

    const token =
        side === "seller"
            ? currentDeal.sellerToken
            : currentDeal.buyerToken;

    if (!token) {
        alert("Authorization token is missing.");
        return;
    }

    setButtonLoading(button, true, "Approving...");

    try {
        const result = await apiRequest(
            `/api/deals/${currentDeal.id}/approve`,
            {
                method: "POST",

                headers: {
                    "x-deal-token": token
                },

                body: JSON.stringify({
                    side: side
                })
            }
        );

        currentDeal.approvals[side] = true;

        button.textContent =
            side === "seller"
                ? "Seller Approved"
                : "Buyer Approved";

        button.disabled = true;
        button.classList.add("approved");

        if (result.bothApproved) {
            setStatus(
                approvalStatus,
                "Both participants approved. Payment is now available."
            );

            showElement(paymentSection);

            paymentAmount.textContent =
                formatCurrency(currentDeal.price);

            await initializePayPal();

        } else {
            setStatus(
                approvalStatus,
                `${side} approved. Waiting for the other participant.`
            );
        }

    } catch (error) {
        console.error("Approval error:", error);

        alert(error.message || "Approval failed.");

        setButtonLoading(button, false);
    }
}


sellerApprove.addEventListener("click", () => {
    approveDeal("seller");
});


buyerApprove.addEventListener("click", () => {
    approveDeal("buyer");
});

async function loadPayPalSDK() {
    if (paypalSdkLoaded) return;

    const config = await apiRequest("/api/config");

    if (!config.clientId) {
        throw new Error("PayPal Client ID is missing.");
    }

    await new Promise((resolve, reject) => {
        const script = document.createElement("script");

        script.src =
            "https://www.paypal.com/sdk/js" +
            `?client-id=${encodeURIComponent(config.clientId)}` +
            `&currency=${encodeURIComponent(config.currency || "USD")}` +
            "&intent=capture";

        script.onload = resolve;

        script.onerror = () => {
            reject(new Error("Unable to load PayPal SDK."));
        };

        document.head.appendChild(script);
    });

    if (!window.paypal) {
        throw new Error("PayPal SDK did not initialize.");
    }

    paypalSdkLoaded = true;
}

async function initializePayPal() {
    if (paypalButtonsRendered) return;

    try {
        setStatus(paymentStatus, "Loading PayPal checkout...");

        await loadPayPalSDK();

        const container =
            document.getElementById("paypal-button-container");

        container.replaceChildren();

        window.paypal.Buttons({

            createOrder: async function () {
                const result = await apiRequest("/api/orders", {
                    method: "POST",

                    headers: {
                        "x-deal-token": currentDeal.buyerToken
                    },

                    body: JSON.stringify({
                        dealId: currentDeal.id
                    })
                });

                return result.orderId;
            },

            onApprove: async function (data) {
                setStatus(
                    paymentStatus,
                    "Processing payment..."
                );

                try {
                    const result = await apiRequest(
                        `/api/orders/${data.orderID}/capture`,
                        {
                            method: "POST",

                            headers: {
                                "x-deal-token": currentDeal.buyerToken
                            },

                            body: JSON.stringify({
                                dealId: currentDeal.id
                            })
                        }
                    );

                    setStatus(
                        paymentStatus,
                        "Payment completed successfully."
                    );

                    await loadReceipt();

                } catch (error) {
                    console.error("Payment capture error:", error);

                    setStatus(
                        paymentStatus,
                        error.message || "Payment verification failed."
                    );
                }
            },


            onCancel: function () {
                setStatus(
                    paymentStatus,
                    "Payment was cancelled."
                );
            },


            onError: function (error) {
                console.error("PayPal error:", error);

                setStatus(
                    paymentStatus,
                    "PayPal checkout encountered an error."
                );
            }

        }).render("#paypal-button-container");

        paypalButtonsRendered = true;

        setStatus(
            paymentStatus,
            "Complete your payment securely using PayPal."
        );

    } catch (error) {
        console.error("PayPal initialization error:", error);

        setStatus(
            paymentStatus,
            error.message || "Unable to initialize PayPal."
        );
    }
}

async function loadReceipt() {
    if (!currentDeal) return;

    try {
        const result = await apiRequest(
            `/api/deals/${currentDeal.id}/receipt`,
            {
                method: "GET",

                headers: {
                    "x-deal-token": currentDeal.buyerToken
                }
            }
        );

        receiptDetails.replaceChildren();

        const rows = [
            ["Item", result.item],
            ["Final Price", formatCurrency(result.price)],
            ["Payment Status", "Completed"],
            ["Transaction ID", result.captureId || "Verified"],
            ["Receipt", result.receipt || "Fair Deal Receipt"]
        ];

        rows.forEach(([label, value]) => {
            const row = document.createElement("div");
            row.className = "receipt-row";

            const heading = document.createElement("strong");
            heading.textContent = label;

            const content = document.createElement("span");
            content.textContent = value;

            row.appendChild(heading);
            row.appendChild(content);

            receiptDetails.appendChild(row);
        });

        showElement(receiptSection);

    } catch (error) {
        console.error("Receipt error:", error);

        setStatus(
            paymentStatus,
            "Payment completed, but the receipt could not be loaded."
        );
    }
}

resetWorkspace();

setStatus(liveIndicator, "Ready");
setStatus(turnCounter, "0 turns");