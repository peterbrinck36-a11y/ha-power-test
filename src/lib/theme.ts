export const THEME_STORAGE_KEY = "marina-theme";

/**
 * Runs before first paint so a stored dark preference never flashes light.
 * Kept as a string so it can be inlined in <head> without shipping a client
 * component just to set a class.
 */
export const themeInitScript = `(function(){try{var stored=localStorage.getItem("${THEME_STORAGE_KEY}");var dark=stored==="dark"||(stored!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
