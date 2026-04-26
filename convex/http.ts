import { authComponent, createAuth } from "./betterAuth/auth";
import router from "./router";

const http = router;

authComponent.registerRoutes(http, createAuth);

export default http;
