import { useQuery } from "@tanstack/react-query";
import { getCurrentUserData } from "../../api/services/auth";
import { getStoredToken } from "../../utils/storage";

function useGetCurrentUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: getCurrentUserData,
    enabled: Boolean(getStoredToken()),
  });
}

export default useGetCurrentUser;
