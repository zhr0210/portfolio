/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                "on-secondary-fixed-variant": "#5b5c5c", "on-surface-variant": "#acabaa", "on-tertiary-fixed": "#4d4300",
                "primary-fixed-dim": "#d4d4d4", "on-secondary": "#1f2021", "primary-dim": "#b8b9b9",
                "tertiary-container": "#fde987", "surface-dim": "#0e0e0e", "tertiary-dim": "#eeda7b",
                "surface-container": "#191a1a", "tertiary-fixed-dim": "#eeda7b", "on-primary-fixed": "#3e4040",
                "on-primary-fixed-variant": "#5a5c5c", "on-tertiary-fixed-variant": "#6d5f07", "primary-fixed": "#e2e2e2",
                "secondary-fixed-dim": "#d5d4d4", "on-error": "#490106", "on-primary-container": "#d0d0d0",
                "error-dim": "#bb5551", "on-tertiary": "#6b5d05", "on-background": "#e7e5e5",
                "surface-container-highest": "#252626", "surface-bright": "#2b2c2c", "inverse-surface": "#fcf9f8",
                "surface-container-low": "#131313", "on-primary": "#3f4041", "outline": "#767575",
                "primary": "#c6c6c7", "inverse-on-surface": "#565555", "on-tertiary-container": "#625500",
                "secondary-container": "#3a3c3c", "on-secondary-fixed": "#3e3f40", "surface": "#0e0e0e",
                "surface-container-lowest": "#000000", "outline-variant": "#484848", "surface-container-high": "#1f2020",
                "inverse-primary": "#5e5f60", "secondary-fixed": "#e3e2e2", "primary-container": "#454747",
                "surface-tint": "#c6c6c7", "tertiary-fixed": "#fde987", "surface-variant": "#252626",
                "error": "#ee7d77", "error-container": "#7f2927", "on-secondary-container": "#bfbfbf",
                "secondary": "#9e9e9e", "background": "#0e0e0e", "on-surface": "#e7e5e5", "tertiary": "#fff6db",
                "on-error-container": "#ff9993", "secondary-dim": "#9e9e9e"
            },
            fontFamily: {
                "headline": ["Inter", "sans-serif"], 
                "body": ["Inter", "sans-serif"],
                "label": ["Inter", "sans-serif"], 
                "mono": ["monospace"]
            },
            borderRadius: { "DEFAULT": "0px", "lg": "0px", "xl": "0px", "full": "9999px" },
        },
    },
    plugins: [],
};
