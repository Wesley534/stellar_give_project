import { useMutation } from "@tanstack/react-query";
import { login, type loginType } from "../../api/services/auth";

function useLogin() {
  return useMutation({
    mutationFn: async ({ email, password }: loginType) => {
      return login({ email, password });
    },
  });
}

export default useLogin;
