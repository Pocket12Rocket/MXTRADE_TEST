export const payfastCheckout = async ({ amount, productId, productName, buyerEmail }) => {
  // Replace this with your PayFast checkout integration.
  // You will need to implement a server-side endpoint that signs the request,
  // performs the transaction, and handles the return / webhook callback.
  return {
    success: true,
    message: 'PayFast checkout is not yet implemented. Configure the gateway and webhook flow.',
    data: { amount, productId, productName, buyerEmail },
  };
};
