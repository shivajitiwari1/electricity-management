import Razorpay from "razorpay";

let _instance: Razorpay | undefined;

function getInstance(): Razorpay {
  if (!_instance) {
    _instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return _instance;
}

export const razorpay = new Proxy({} as Razorpay, {
  get(_, prop) {
    return getInstance()[prop as keyof Razorpay];
  },
});
