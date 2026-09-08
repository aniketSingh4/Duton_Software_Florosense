export function verifyFlorosenseApiKey(req, res, next) {
  try {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      return res.status(401).json({
        detail: "X-API-Key header is required",
        hint: "Include 'X-API-Key: <your-api-key>' in request headers"
      });
    }

    const validApiKey = process.env.NEXT_PUBLIC_FLOROSENSE_API_KEY;

    if (!validApiKey) {
      return res.status(500).json({
        detail: "NEXT_PUBLIC_FLOROSENSE_API_KEY is not configured on the server"
      });
    }

    if (apiKey !== validApiKey) {
      return res.status(401).json({
        detail: "Invalid API key"
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      detail: "Error validating API key",
      error: error.message
    });
  }
}
