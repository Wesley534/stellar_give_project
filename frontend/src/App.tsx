import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "./context/WalletContext";
import { AppRouter } from "./routes/AppRouter";
// import { AuthProvider } from './context/AuthContext'
import "./index.css";
import "./App.css";

function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // staleTime: 60 * 1000,
        staleTime: 0,
      },
    },
  });
  return (
    <>
      {/* // <AuthProvider> */}
      {/* <Toaster position="top-right" reverseOrder={false} /> */}
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <AppRouter />
        </WalletProvider>

        <Toaster
          position="top-center"
          gutter={12}
          containerStyle={{ margin: "8px" }}
          toastOptions={{
            success: {
              duration: 3000,
            },
            error: {
              duration: 5000,
            },
            style: {
              fontSize: "16px",
              maxWidth: "500px",
              padding: "16px 24px",
              backgroundColor: "var(--color-grey-0)",
              color: "var(--color-grey-700)",
            },
          }}
        />
        {/* // </AuthProvider> */}
      </QueryClientProvider>
    </>
  );
}

export default App;
