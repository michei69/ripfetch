import { createRouter } from "@solidjs/router";
import GamePage from "./pages/GamePage";
import SearchPage from "./pages/SearchPage";

/**
 * One route tree for the whole app. Routes are plain config objects, and the
 * pages are eager imports: at two routes a lazy boundary would cost more than
 * the code it defers.
 */
export const Router = createRouter({
  routes: [
    { path: "/", component: SearchPage },
    { path: "/game/:id", component: GamePage },
  ],
});
