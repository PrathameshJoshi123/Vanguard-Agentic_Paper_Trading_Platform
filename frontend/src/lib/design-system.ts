import type { CSSProperties } from "react";

export const CONTROL_SHADOW_STYLE: CSSProperties = {
  boxShadow:
    "0px 0px 0px 1px var(--effectsDropshadow, #00000066), 0px 0px 0px 1px var(--effectsinnershadow2, #FFFFFF0F) inset, 0px 1px 0px 0px var(--effectsinnershadow, #FFFFFF1A) inset",
};

export const SELECTED_NAV_STYLE: CSSProperties = {
  background: "var(--Colors-Base-Selection)",
  boxShadow:
    "0px 0px 0px 1px var(--effectsinnershadow2) inset, 0px 1px 0px 0px var(--effectsinnershadow) inset, 0px 0px 0px 1px var(--effectsDropshadow)",
};

export const MODAL_SHADOW_STYLE: CSSProperties = {
  background: "var(--Colors-Base-Primary-background, #171717)",
  boxShadow:
    "0px 0px 0px 1px var(--effectsinnershadow2, #FFFFFF0F) inset, 0px 1px 0px 0px var(--effectsinnershadow, #FFFFFF1A) inset, 0px 0px 0px 1px var(--effectsDropshadow, #00000066), 0 20px 40px -15px rgba(0,0,0,0.5)",
};
