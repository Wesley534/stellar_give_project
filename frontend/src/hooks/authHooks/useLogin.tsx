import { useMutation } from "@tanstack/react-query";
import { login, type loginType } from "../../api/services/auth";
import { toast } from "react-hot-toast";

function useLogin() {
  return useMutation({
    mutationFn: async ({ email, password }: loginType) => {
      return login({ email, password });
    },
    onSuccess: (data) => {
      // console.log("Login successful, received token:", data?.data?.data?.token);
      toast.success(`${data.data.message}`);
      localStorage.setItem("token", data?.data?.data?.token);
      // Optionally, you can also store user info in localStorage or context
    },
  });
}
// hori@mail.com
export default useLogin;
