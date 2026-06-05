import { useQuery } from "@tanstack/react-query";
import { getCurrentUserData } from "../../api/services/auth";

function useGetCurrentUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: getCurrentUserData,
  });
}

export default useGetCurrentUser;
