import { useMutation } from "@tanstack/react-query";
import { login, type loginType } from "../../api/services/auth";
import { toast } from "react-hot-toast";
import { setStoredToken } from "../../utils/storage";

function useLogin() {
  return useMutation({
    mutationFn: async ({ email, password }: loginType) => {
      return login({ email, password });
    },
    onSuccess: (data) => {
      toast.success(`${data.data.message}`);
      setStoredToken(data?.data?.data?.token);
    },
  });
}
// hori@mail.com
export default useLogin;
