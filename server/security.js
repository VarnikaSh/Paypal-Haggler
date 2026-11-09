const crypto = require("crypto");

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createDealTokens() {
  return {
    sellerToken: generateToken(),
    buyerToken: generateToken()
  };
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function verifyToken(providedToken, storedHash) {

  if (
    typeof providedToken !== "string" ||
    typeof storedHash !== "string"
  ) {
    return false;
  }

  const providedHash = hashToken(providedToken);

  const providedBuffer = Buffer.from(providedHash, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (providedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    providedBuffer,
    storedBuffer
  );
}

function authorizeParticipant(deal, side, token) {

  if (!deal || !["seller", "buyer"].includes(side)) {
    return false;
  }

  const storedHash =
    side === "seller"
      ? deal.sellerTokenHash
      : deal.buyerTokenHash;

  return verifyToken(token, storedHash);
}

function validateDealInputs(data) {

  const item = String(data.item || "").trim();

  const listPrice = Number(data.listPrice);
  const sellerMin = Number(data.sellerMin);
  const buyerMax = Number(data.buyerMax);

  if (!item || item.length > 80) {
    throw new Error("Invalid product name.");
  }

  if (
    !Number.isFinite(listPrice) ||
    !Number.isFinite(sellerMin) ||
    !Number.isFinite(buyerMax)
  ) {
    throw new Error("Prices must be valid numbers.");
  }

  if (
    listPrice <= 0 ||
    sellerMin <= 0 ||
    buyerMax <= 0
  ) {
    throw new Error("Prices must be greater than zero.");
  }

  if (sellerMin > listPrice) {
    throw new Error(
      "Seller minimum cannot exceed listing price."
    );
  }

  if (buyerMax < sellerMin) {
    throw new Error(
      "No possible agreement: buyer maximum is below seller minimum."
    );
  }

  if (
    listPrice > 1000000 ||
    sellerMin > 1000000 ||
    buyerMax > 1000000
  ) {
    throw new Error("Price exceeds the permitted limit.");
  }

  return {
    item,
    listPrice: Math.round(listPrice * 100) / 100,
    sellerMin: Math.round(sellerMin * 100) / 100,
    buyerMax: Math.round(buyerMax * 100) / 100
  };
}

module.exports = {
  generateToken,
  createDealTokens,
  hashToken,
  verifyToken,
  authorizeParticipant,
  validateDealInputs
};