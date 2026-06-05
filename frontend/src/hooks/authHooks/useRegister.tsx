import { useMutation } from "@tanstack/react-query";
import { register, type registerType } from "../../api/services/auth";
import toast from "react-hot-toast";

function useRegister() {
  return useMutation({
    mutationFn: async (registerData: registerType) => {
      return register(registerData);
    },
    onSuccess: (data) => {
      toast.success(`${data.data.message}`);
      localStorage.setItem("token", data?.data?.data?.token);
    },
    onError(error) {
      toast.error("Registration failed");
      console.error("Registration error:", error);
    },
  });
}

export default useRegister;
