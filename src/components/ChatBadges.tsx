"use client";

import { useId } from "react";
import type { SubBadge } from "@/lib/types";

/* Chat identity badges — the EXACT vector art Kick serves in its own chat,
   extracted from Kick's web bundle (each badge is a 0 0 32 32 SVG). Gradient
   and clip ids are namespaced per render with useId() so multiple badges on a
   page can't collide. A channel's own subscriber badges still use the real art
   Kick serves for that channel (subscriber_badges → files.kick.com), picked by
   subscription months exactly like Kick's chat; the star here is Kick's default
   subscriber badge, used only when a channel ships no custom art. */

export type ChatBadgeData = { type: string; text?: string; count?: number };

/* Global "v2" badges Kick now carries in `identity.badges_v2` — image-based
   badges that show on a user's name in ANY channel: the account level badge
   and Kick-chest collectible badges (Unikorn, Flyby, GOAT, Golden K, …). Each
   entry is self-describing with a full `image_url`, so we render it directly
   (like emotes / channel sub art) rather than mapping types to local art. */
export type GlobalBadge = { imageUrl: string; title: string };

function GlobalImageBadge({ badge }: { badge: GlobalBadge }) {
  return (
    <img
      src={badge.imageUrl}
      alt={badge.title}
      title={badge.title}
      loading="lazy"
      className="mr-1 inline-block h-4 w-4 shrink-0 object-contain align-text-bottom"
    />
  );
}

function Svg({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <span className="mr-1 inline-block h-4 w-4 shrink-0 align-text-bottom" title={title}>
      <svg viewBox="0 0 32 32" className="h-full w-full" aria-label={title} role="img">
        {children}
      </svg>
    </span>
  );
}

/* --- individual badges (Kick's exact 32×32 art) --- */

// Moderator: holographic ban-hammer. Red base with gold + blue layers that
// shimmer over it (Kick animates the same three gradient layers).
function Moderator() {
  const uid = useId().replace(/:/g, "");
  const D =
    "M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 0 2 0H30ZM16.2197 2.99316C15.8292 2.60266 15.1962 2.60265 14.8057 2.99316L8.36328 9.43555C7.97294 9.82608 7.97284 10.4591 8.36328 10.8496L10.0918 12.5781C10.4823 12.9686 11.1153 12.9685 11.5059 12.5781L11.585 12.499L13.9414 14.8564L3.57129 25.2275C2.70357 26.0954 2.7035 27.5023 3.57129 28.3701C4.43911 29.2376 5.84612 29.2377 6.71387 28.3701L17.084 17.999L19.4414 20.3564L19.3633 20.4346C18.9728 20.8251 18.9728 21.4581 19.3633 21.8486L21.0918 23.5771C21.4823 23.9676 22.1154 23.9676 22.5059 23.5771L28.9482 17.1348C29.3386 16.7443 29.3386 16.1112 28.9482 15.7207L27.2197 13.9922C26.8293 13.6017 26.1962 13.6018 25.8057 13.9922L25.7266 14.0703L23.3701 11.7139C24.2377 10.8461 24.2376 9.4391 23.3701 8.57129C22.5023 7.7035 21.0954 7.70357 20.2275 8.57129L17.8701 6.21387L17.9482 6.13574C18.3388 5.74522 18.3388 5.11221 17.9482 4.72168L16.2197 2.99316Z";
  return (
    <Svg title="Moderator">
      <defs>
        <linearGradient id={`${uid}r`} x1="18.8102" y1="-12.7222" x2="2.88536" y2="39.1063" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF6A4A" />
          <stop offset="1" stopColor="#C70C00" />
        </linearGradient>
        <linearGradient id={`${uid}y`} x1="15.7467" y1="-4.75575" x2="16.321" y2="39.0672" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC900" />
          <stop offset="0.99" stopColor="#FF9500" />
        </linearGradient>
        <linearGradient id={`${uid}b`} x1="-14.9543" y1="46.9544" x2="32.0001" y2="-0.000509222" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0095FF" />
          <stop offset="0.99" stopColor="#00C7FF" />
        </linearGradient>
      </defs>
      <path d={D} fill={`url(#${uid}r)`} />
      <path className="kb-shimmer" d={D} fill={`url(#${uid}y)`} />
      <path className="kb-shimmer-2" d={D} fill={`url(#${uid}b)`} />
    </Svg>
  );
}

// Broadcaster: magenta microphone.
function Broadcaster() {
  const uid = useId().replace(/:/g, "");
  return (
    <Svg title="Broadcaster">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF1CD2" />
          <stop offset="1" stopColor="#B20DFF" />
        </linearGradient>
      </defs>
      <path
        d="M15.6773 22.1533C17.3698 22.1533 18.8182 21.5507 20.0233 20.3461C21.2282 19.1415 21.8307 17.6924 21.8307 16V6.15401C21.8307 4.46162 21.2286 3.01305 20.0233 1.80784C18.8182 0.602907 17.3698 0 15.6773 0C13.9849 0 12.5363 0.602907 11.3311 1.80784C10.1259 3.01285 9.52344 4.46162 9.52344 6.15401V16C9.52344 17.6923 10.1262 19.1415 11.3311 20.3461C12.5361 21.5507 13.9849 22.1533 15.6773 22.1533Z"
        fill={`url(#${uid})`}
      />
      <path
        d="M26.3888 12.6731C26.1459 12.4295 25.8568 12.3076 25.5234 12.3076C25.1904 12.3076 24.902 12.4295 24.6581 12.6731C24.4147 12.9167 24.293 13.2051 24.293 13.5383V16C24.293 18.3718 23.4498 20.4006 21.7639 22.0864C20.0785 23.7723 18.0495 24.6153 15.6775 24.6153C13.3057 24.6153 11.2769 23.7723 9.59089 22.0864C7.90509 20.401 7.06226 18.3719 7.06226 16V13.5383C7.06226 13.2051 6.94041 12.9167 6.69692 12.6731C6.45329 12.4295 6.16514 12.3076 5.83159 12.3076C5.49804 12.3076 5.20956 12.4295 4.96606 12.6731C4.72237 12.9167 4.60059 13.2051 4.60059 13.5383V16C4.60059 18.8333 5.54627 21.2981 7.4371 23.3941C9.32799 25.4901 11.6645 26.6919 14.4467 26.9994V29.5381H9.52373C9.19038 29.5381 8.90196 29.6601 8.6584 29.9037C8.41477 30.1472 8.29293 30.4357 8.29293 30.7691C8.29293 31.1019 8.41477 31.391 8.6584 31.6344C8.90196 31.8778 9.19038 32 9.52373 32H21.831C22.1643 32 22.4531 31.8779 22.6963 31.6344C22.9402 31.391 23.0622 31.1019 23.0622 30.7691C23.0622 30.4358 22.9402 30.1472 22.6963 29.9037C22.4532 29.6601 22.1644 29.5381 21.831 29.5381H16.9086V26.9994C19.6904 26.6919 22.0267 25.4901 23.9178 23.3941C25.8089 21.2981 26.7548 18.8333 26.7548 16V13.5383C26.7548 13.2051 26.6327 12.9169 26.3888 12.6731Z"
        fill={`url(#${uid})`}
      />
    </Svg>
  );
}

// Verified: green Kick seal with a check.
function Verified() {
  const uid = useId().replace(/:/g, "");
  return (
    <Svg title="Verified">
      <defs>
        <linearGradient id={uid} x1="8.14138" y1="32.3591" x2="24.4968" y2="0.904884" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1EFF00" />
          <stop offset="0.99" stopColor="#00FF8C" />
        </linearGradient>
      </defs>
      <path
        d="M30.8598 19.2368C30.1977 18.2069 29.5356 17.2138 28.8736 16.1839C28.7264 15.9632 28.7264 15.8161 28.8736 15.5954C29.5356 14.6023 30.1609 13.6092 30.823 12.6161C31.5954 11.4391 31.1908 10.2989 29.8667 9.82069C28.7632 9.41609 27.6598 8.97471 26.5563 8.57012C26.3356 8.49656 26.2253 8.34943 26.2253 8.09196C26.1885 6.87816 26.1149 5.66437 26.0414 4.48736C25.9678 3.2 24.9747 2.46437 23.7241 2.7954C22.5471 3.08966 21.3701 3.42069 20.2299 3.75173C19.9724 3.82529 19.8253 3.75173 19.6414 3.56782C18.9057 2.61149 18.1333 1.69195 17.3977 0.772414C16.5885 -0.257472 15.3379 -0.257472 14.492 0.772414C13.7563 1.69195 12.9839 2.61149 12.2851 3.53103C12.1012 3.7885 11.9172 3.82529 11.623 3.75173C10.4828 3.42069 9.34253 3.12644 8.53334 2.90575C6.95173 2.53793 5.99541 3.16322 5.92184 4.48736C5.84828 5.70115 5.77472 6.91495 5.73794 8.16552C5.73794 8.42299 5.62759 8.53333 5.4069 8.64368C4.26667 9.08506 3.12644 9.52644 1.98621 9.96782C0.809203 10.446 0.441387 11.5862 1.14023 12.6529C1.8023 13.6828 2.46437 14.6759 3.12644 15.7057C3.27356 15.9264 3.27356 16.0736 3.12644 16.331C2.42759 17.3609 1.76552 18.3908 1.10345 19.4575C0.478165 20.4506 0.882759 21.6276 1.98621 22.069C3.12644 22.5104 4.30345 22.9517 5.44368 23.3931C5.70115 23.4667 5.77471 23.6138 5.77471 23.8713C5.81149 25.0483 5.95862 26.1885 5.95862 27.3655C5.95862 28.5425 6.9885 29.6092 8.42298 29.1678C9.56321 28.8 10.7034 28.5425 11.8437 28.2115C12.0644 28.1379 12.2115 28.1747 12.3586 28.3954C13.131 29.3517 13.8667 30.2713 14.6391 31.2276C15.485 32.2575 16.6988 32.2575 17.508 31.2276C18.2805 30.2713 19.0161 29.3517 19.7885 28.3954C19.9356 28.2115 20.046 28.1379 20.3034 28.2115C21.4804 28.5425 22.6575 28.8368 23.8345 29.1678C25.0483 29.4988 26.0781 28.7632 26.1149 27.5126C26.1885 26.2989 26.2621 25.0851 26.2988 23.8345C26.2988 23.5402 26.446 23.4299 26.6667 23.3563C27.7701 22.9517 28.9103 22.5104 30.0138 22.069C31.1908 21.4805 31.5586 20.3034 30.8598 19.2368ZM22.069 13.2046L14.7127 20.5609C14.5287 20.7448 14.2713 20.892 14.0138 20.9287C13.9402 20.9287 13.8299 20.9655 13.7563 20.9655C13.4253 20.9655 13.0575 20.8184 12.8 20.5609L9.78392 17.5448C9.26898 17.0299 9.26898 16.1839 9.78392 15.669C10.2989 15.154 11.1448 15.154 11.6598 15.669L13.7196 17.7287L20.1196 11.3287C20.6345 10.8138 21.4805 10.8138 21.9954 11.3287C22.5839 11.8437 22.5839 12.6897 22.069 13.2046Z"
        fill={`url(#${uid})`}
      />
    </Svg>
  );
}

// OG: teal interlocking Kick "K".
function OG() {
  const uid = useId().replace(/:/g, "");
  return (
    <Svg title="OG">
      <defs>
        <linearGradient id={`${uid}a`} x1="23.9622" y1="0.695162" x2="24.4274" y2="31.9986" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFF2" />
          <stop offset="1" stopColor="#006399" />
        </linearGradient>
        <linearGradient id={`${uid}b`} x1="7.77104" y1="0" x2="7.91062" y2="32.567" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFF2" />
          <stop offset="1" stopColor="#006399" />
        </linearGradient>
      </defs>
      <path d="M22.8226 17.2693V28.0037C22.8226 28.2177 22.8929 28.383 23.0336 28.4996C23.1742 28.5969 23.3969 28.6455 23.7017 28.6455H24.5104V32H21.838C19.9627 32 18.6265 31.6694 17.8294 31.0082C17.0559 30.347 16.6691 29.472 16.6691 28.383V16.8901C16.6691 15.8011 17.0559 14.926 17.8294 14.2648C18.6265 13.6036 19.9627 13.273 21.838 13.273H24.6511V16.6276H23.7017C23.3969 16.6276 23.1742 16.6859 23.0336 16.8026C22.8929 16.8998 22.8226 17.0554 22.8226 17.2693ZM32.0002 21.6447V24.8826H24.0885V21.6447H32.0002ZM25.8466 19.6904V17.2693C25.8466 17.0554 25.7763 16.8998 25.6357 16.8026C25.495 16.6859 25.2723 16.6276 24.9676 16.6276H24.0182V13.273H26.8312C28.7066 13.273 30.031 13.6036 30.8046 14.2648C31.6017 14.926 32.0002 15.8011 32.0002 16.8901V19.6904H25.8466ZM25.8466 28.0037V23.8908H32.0002V28.383C32.0002 29.472 31.6017 30.347 30.8046 31.0082C30.031 31.6694 28.7066 32 26.8312 32H24.1588V28.6455H24.9676C25.2723 28.6455 25.495 28.5969 25.6357 28.4996C25.7763 28.383 25.8466 28.2177 25.8466 28.0037Z" fill={`url(#${uid}a)`} />
      <path d="M22.8228 3.99625V14.7307C22.8228 14.9446 22.8931 15.1099 23.0338 15.2266C23.1744 15.3238 23.3971 15.3724 23.7019 15.3724H24.5106V18.727H21.8382C19.9629 18.727 18.6267 18.3964 17.8296 17.7352C17.056 17.074 16.6693 16.1989 16.6693 15.1099V3.61704C16.6693 2.52804 17.056 1.65295 17.8296 0.99177C18.6267 0.33059 19.9629 0 21.8382 0H24.6513V3.35452H23.7019C23.3971 3.35452 23.1744 3.41286 23.0338 3.52953C22.8931 3.62677 22.8228 3.78234 22.8228 3.99625ZM32.0004 8.37171V11.6095H24.0887V8.37171H32.0004ZM25.8468 6.41734V3.99625C25.8468 3.78234 25.7765 3.62677 25.6358 3.52953C25.4952 3.41286 25.2725 3.35452 24.9677 3.35452H24.0183V0H26.8314C28.7067 0 30.0312 0.33059 30.8048 0.99177C31.6018 1.65295 32.0004 2.52804 32.0004 3.61704V6.41734H25.8468Z" fill="#00FFF2" />
      <path d="M9.38855 7.81748V4.28795C9.38855 4.07404 9.31822 3.91846 9.17757 3.82123C9.03691 3.70455 8.81421 3.64621 8.50947 3.64621H7.34909V0H10.3731C12.2485 0 13.573 0.33059 14.3465 0.99177C15.1436 1.65295 15.5421 2.52804 15.5421 3.61704V7.81748H9.38855ZM9.38855 14.439V7.43828H15.5421V15.1099C15.5421 16.1989 15.1436 17.074 14.3465 17.7352C13.573 18.3964 12.2485 18.727 10.3731 18.727H7.34909V15.0807H8.50947C8.81421 15.0807 9.03691 15.0321 9.17757 14.9349C9.31822 14.8182 9.38855 14.6529 9.38855 14.439ZM6.15354 4.28795V7.81748H0V3.61704C0 2.52804 0.386794 1.65295 1.16038 0.99177C1.95741 0.33059 3.29361 0 5.16897 0H8.193V3.64621H7.03262C6.72787 3.64621 6.50517 3.70455 6.36452 3.82123C6.22387 3.91846 6.15354 4.07404 6.15354 4.28795Z" fill={`url(#${uid}b)`} />
      <path d="M9.38839 21.0905V17.561C9.38839 17.3471 9.31807 17.1915 9.17741 17.0943C9.03676 16.9776 8.81406 16.9193 8.50932 16.9193H7.34893V13.273H10.373C12.2483 13.273 13.5728 13.6036 14.3464 14.2648C15.1434 14.926 15.5419 15.8011 15.5419 16.8901V21.0905H9.38839ZM9.38839 27.712V20.7113H15.5419V28.383C15.5419 29.472 15.1434 30.347 14.3464 31.0082C13.5728 31.6694 12.2483 32 10.373 32H7.34893V28.3538H8.50932C8.81406 28.3538 9.03676 28.3052 9.17741 28.2079C9.31807 28.0913 9.38839 27.926 9.38839 27.712ZM6.15339 17.561V21.0905H0V16.8901C0 15.8011 0.386641 14.926 1.16023 14.2648C1.95726 13.6036 3.29346 13.273 5.16882 13.273H8.19285V16.9193H7.03247C6.72772 16.9193 6.50502 16.9776 6.36437 17.0943C6.22371 17.1915 6.15339 17.3471 6.15339 17.561Z" fill="#00FFF2" />
    </Svg>
  );
}

// VIP: gold crown.
function Vip() {
  const uid = useId().replace(/:/g, "");
  const D =
    "M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 4.10637e-08 2 0H30ZM15.9648 5C15.7748 5.00005 15.588 5.05204 15.4238 5.15039C15.2596 5.24878 15.124 5.39057 15.0303 5.56055L9.82812 15.0176L3.55078 11.8906C3.36913 11.7985 3.16534 11.7607 2.96387 11.7822C2.76241 11.8038 2.57048 11.8842 2.41113 12.0127C2.25235 12.1408 2.13185 12.3126 2.06348 12.5078C1.99511 12.7031 1.98143 12.9144 2.02441 13.1172L4.58301 25.127C4.63544 25.3782 4.77165 25.6034 4.96777 25.7627C5.16376 25.9217 5.40762 26.0056 5.65723 26H26.251C26.5009 26.0057 26.7453 25.9219 26.9414 25.7627C27.1376 25.6034 27.2737 25.3782 27.3262 25.127L29.9697 13.1172C30.0187 12.9103 30.0086 12.6932 29.9404 12.4922C29.8722 12.2912 29.7485 12.1151 29.585 11.9844C29.4215 11.8537 29.2249 11.7743 29.0186 11.7559C28.8122 11.7374 28.6049 11.7802 28.4219 11.8799L22.1025 15.0283L16.9004 5.56055C16.8066 5.39054 16.6701 5.24878 16.5059 5.15039C16.3416 5.05207 16.1549 5 15.9648 5Z";
  return (
    <Svg title="VIP">
      <defs>
        <linearGradient id={`${uid}a`} x1="18.8102" y1="-12.7222" x2="2.88536" y2="39.1063" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF6A4A" />
          <stop offset="1" stopColor="#C70C00" />
        </linearGradient>
        <linearGradient id={`${uid}b`} x1="15.7467" y1="-4.75575" x2="16.321" y2="39.0672" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC900" />
          <stop offset="0.99" stopColor="#FF9500" />
        </linearGradient>
      </defs>
      <path d={D} fill={`url(#${uid}a)`} />
      <path d={D} fill={`url(#${uid}b)`} />
    </Svg>
  );
}

// Founder: gold coin with a "1".
function Founder() {
  const uid = useId().replace(/:/g, "");
  return (
    <Svg title="Founder">
      <defs>
        <linearGradient id={`${uid}a`} x1="15.7467" y1="-4.46667" x2="16.2533" y2="36.6933" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC900" />
          <stop offset="0.99" stopColor="#FF9500" />
        </linearGradient>
        <linearGradient id={`${uid}b`} x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.3" />
          <stop offset="1" stopColor="white" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={`${uid}c`} x1="15.7936" y1="-0.677142" x2="16.2064" y2="32.8618" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC900" />
          <stop offset="0.99" stopColor="#FF9500" />
        </linearGradient>
      </defs>
      <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill={`url(#${uid}a)`} />
      <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill={`url(#${uid}b)`} />
      <path d="M16 29.0375C23.2004 29.0375 29.0375 23.2004 29.0375 16C29.0375 8.79958 23.2004 2.96249 16 2.96249C8.79959 2.96249 2.9625 8.79958 2.9625 16C2.9625 23.2004 8.79959 29.0375 16 29.0375Z" fill={`url(#${uid}c)`} />
      <path d="M18.5966 9.45456V24H14.6477V13.0909H14.5625L11.3807 14.9943V11.6421L14.9602 9.45456H18.5966Z" fill="black" fillOpacity="0.8" />
    </Svg>
  );
}

// Kick staff: green Kick "K" tile.
function Staff() {
  const uid = useId().replace(/:/g, "");
  return (
    <Svg title="Kick staff">
      <defs>
        <linearGradient id={uid} x1="8.99888" y1="34.208" x2="20.0805" y2="-2.27173" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1EFF00" />
          <stop offset="0.99" stopColor="#00FF8C" />
        </linearGradient>
      </defs>
      <path
        d="M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 4.10637e-08 2 0H30ZM6 5V27H13.5029V22.1162H16V24.5576H18.4971V27H26V19.6631H23.5029V17.2207H20.9941V14.7793H23.5029V12.3369H26V5H18.4971V7.44238H16V9.88379H13.5029V5H6Z"
        fill={`url(#${uid})`}
      />
    </Svg>
  );
}

// Sidekick: red tile with the Kick sidekick mask.
function Sidekick() {
  const uid = useId().replace(/:/g, "");
  return (
    <Svg title="Sidekick">
      <defs>
        <linearGradient id={uid} x1="18.8102" y1="-12.7222" x2="2.88536" y2="39.1063" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF6A4A" />
          <stop offset="1" stopColor="#C70C00" />
        </linearGradient>
      </defs>
      <path
        d="M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 4.10637e-08 2 0H30ZM29.5244 11.3008C29.5244 11.3008 25.2627 10.4758 21.0332 11.5596C18.8953 12.1069 16.3789 14.1719 16.3789 14.1719C16.1704 14.343 15.8296 14.343 15.6211 14.1719C15.6211 14.1719 13.1047 12.1069 10.9668 11.5596C6.74733 10.4784 2.4957 11.2969 2.47559 11.3008C2.20629 11.353 1.99226 11.6104 2 11.873C2 11.873 2.25315 20.0384 8.10938 21.7568C11.2306 22.6722 15.5488 20.7051 15.5488 20.7051C15.7969 20.5923 16.2029 20.5923 16.4512 20.7051C16.4512 20.7051 20.7698 22.6722 23.8896 21.7568C29.7469 20.0382 30 11.873 30 11.873C30.0076 11.6104 29.7937 11.353 29.5244 11.3008ZM21.5322 14.3301C24.071 13.2488 26.4385 14.1729 26.4385 14.1729C26.7938 14.3116 26.9784 14.7083 26.8486 15.0537C26.839 15.0791 25.9689 17.3603 23.4443 18.4355C20.9228 19.5093 18.5704 18.6049 18.5391 18.5928C18.1836 18.4541 17.9991 18.0573 18.1289 17.7119C18.138 17.688 19.007 15.4058 21.5322 14.3301ZM5.43652 14.1162C5.43652 14.1162 7.80404 13.1921 10.3428 14.2734C12.8674 15.3488 13.7366 17.6302 13.7461 17.6553C13.8761 18.0007 13.6914 18.3975 13.3359 18.5361C13.3029 18.5489 10.9514 19.4515 8.43066 18.3779C5.89367 17.2966 5.02734 14.9961 5.02734 14.9961C4.89754 14.6507 5.08139 14.2549 5.43652 14.1162Z"
        fill={`url(#${uid})`}
      />
    </Svg>
  );
}

// Kick's default subscriber badge (a sparkle) — only used when a channel
// ships no custom subscriber art. Tinted by tier via a radial gradient.
function SubStar({ months }: { months?: number }) {
  const uid = useId().replace(/:/g, "");
  const title = months ? `Subscriber (${months} month${months === 1 ? "" : "s"})` : "Subscriber";
  const D =
    "M17.0284 2.91378L16.2357 0.667951C16.1573 0.445558 15.8427 0.445558 15.7643 0.667951L14.9716 2.91378C12.9003 8.78263 8.78263 12.9003 2.91378 14.9716L0.667951 15.7643C0.445558 15.8427 0.445558 16.1573 0.667951 16.2357L2.91378 17.0284C8.78263 19.0998 12.9003 23.2174 14.9716 29.0862L15.7643 31.3321C15.8427 31.5544 16.1573 31.5544 16.2357 31.3321L17.0284 29.0862C19.0998 23.2174 23.2174 19.0998 29.0862 17.0284L31.3321 16.2357C31.5544 16.1573 31.5544 15.8427 31.3321 15.7643L29.0862 14.9716C23.2174 12.9003 19.0998 8.78263 17.0284 2.91378Z";
  return (
    <Svg title={title}>
      <defs>
        <radialGradient id={uid} cx="0" cy="0" r="1" gradientTransform="translate(16 16) rotate(90) scale(16)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E1FF00" />
          <stop offset="1" stopColor="#2AA300" />
        </radialGradient>
      </defs>
      <path d={D} fill="black" />
      <path d={D} fill={`url(#${uid})`} />
    </Svg>
  );
}

// Sub gifter: Kick's gift box, tinted up the tier ladder by total gifts.
function SubGifter({ count = 1 }: { count?: number }) {
  const [light, dark] =
    count >= 200
      ? ["#FFD899", "#FF9D00"] // gold
      : count >= 100
        ? ["#FBCFD8", "#F2708A"] // pink
        : count >= 50
          ? ["#DEB2FF", "#BC66FF"] // purple
          : count >= 25
            ? ["#2EFAD1", "#00A18D"] // teal
            : ["#53FC18", "#32970E"]; // green
  return (
    <Svg title={`Sub gifter (${count} gifted)`}>
      <path d="M22.34 9.5L26 4H18L16 7L14 4H6L9.66 9.5H4V15.1H28V9.5H22.34Z" fill={light} />
      <path d="M26.0799 19.0996H5.8999V28.4996H26.0799V19.0996Z" fill={light} />
      <path d="M26.0799 15.0996H5.8999V19.0996H26.0799V15.0996Z" fill={dark} />
    </Svg>
  );
}

/** Channel subscriber badge: the real art for this channel from Kick, picked
    by months (highest tier the subscriber has reached), like Kick's chat. */
function ChannelSub({ months = 1, subBadges }: { months?: number; subBadges: SubBadge[] }) {
  let src: string | null = null;
  for (const b of subBadges) if (months >= b.months) src = b.src;
  if (!src) return <SubStar months={months} />;
  return (
    <img
      src={src}
      alt="Subscriber"
      title={`Subscriber (${months} month${months === 1 ? "" : "s"})`}
      loading="lazy"
      className="mr-1 inline-block h-4 w-4 shrink-0 rounded-[3px] object-contain align-text-bottom"
    />
  );
}

function BadgeIcon({ badge, subBadges }: { badge: ChatBadgeData; subBadges: SubBadge[] }) {
  switch (badge.type) {
    case "broadcaster":
      return <Broadcaster />;
    case "moderator":
      return <Moderator />;
    case "verified":
      return <Verified />;
    case "og":
      return <OG />;
    case "vip":
      return <Vip />;
    case "founder":
      return <Founder />;
    case "staff":
      return <Staff />;
    case "sidekick":
      return <Sidekick />;
    case "subscriber":
      return <ChannelSub months={badge.count} subBadges={subBadges} />;
    case "sub_gifter":
      return <SubGifter count={badge.count} />;
    default:
      return null; // unknown/new badge types just don't render
  }
}

export default function ChatBadges({
  badges,
  globalBadges = [],
  subBadges,
}: {
  badges: ChatBadgeData[];
  globalBadges?: GlobalBadge[];
  subBadges: SubBadge[];
}) {
  return (
    <>
      {/* Global badges (level + Kick-chest collectibles) lead, like Kick's chat */}
      {globalBadges.map((b, i) => (
        <GlobalImageBadge key={`g-${i}`} badge={b} />
      ))}
      {badges.map((b, i) => (
        <BadgeIcon key={`${b.type}-${i}`} badge={b} subBadges={subBadges} />
      ))}
    </>
  );
}
