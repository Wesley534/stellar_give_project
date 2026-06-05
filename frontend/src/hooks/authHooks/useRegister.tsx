import { useMutation } from "@tanstack/react-query";
import { register, type registerType } from "../../api/services/auth";

function useRegister() {
  return useMutation({
    mutationFn: async (registerData: registerType) => {
      return register(registerData);
    },
  });
}

export default useRegister;
