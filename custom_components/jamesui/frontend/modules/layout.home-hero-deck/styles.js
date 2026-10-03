export const HOME_HERO_DECK_STYLES = `
[data-jui-layout="home-hero-deck"] {
  container-type: inline-size;
  display: grid;
  grid-template-rows: var(--jui-home-hero-ratio) minmax(auto, 1fr);
  min-height: 100%;
  height: 100%;
  min-width: 0;
  overflow: visible;
}

[data-jui-layout="home-hero-deck"] [data-jui-layout-region="hero"] {
  min-width: 0;
  min-height: 0;
}

[data-jui-layout="home-hero-deck"] [data-jui-layout-region="deck"] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--jui-space-6);
  min-width: 0;
  margin-top: calc(var(--jui-space-6) * -1);
  padding: var(--jui-space-6);
  border-top: 1px solid var(--jui-color-border-strong);
  border-radius: var(--jui-radius-xl) var(--jui-radius-xl) 0 0;
  background: linear-gradient(180deg, var(--jui-color-surface), var(--jui-color-surface-raised));
  backdrop-filter: blur(var(--jui-blur-md));
  -webkit-backdrop-filter: blur(var(--jui-blur-md));
  box-shadow: var(--jui-shadow-surface), var(--jui-shadow-inset-highlight);
}

[data-jui-layout="home-hero-deck"] [data-jui-layout-region="left"] {
  min-width: 0;
}

[data-jui-layout="home-hero-deck"] [data-jui-layout-region="right"] {
  display: grid;
  grid-template-rows: minmax(auto, 1fr) auto;
  gap: var(--jui-space-4);
  min-width: 0;
}

[data-jui-layout="home-hero-deck"] [data-jui-layout-slot] {
  min-width: 0;
}

@container (max-width: 44rem) {
  [data-jui-layout="home-hero-deck"] [data-jui-layout-region="deck"] {
    grid-template-columns: minmax(0, 1fr);
  }

  [data-jui-layout="home-hero-deck"] [data-jui-layout-region="right"] {
    grid-template-rows: minmax(auto, 1fr) auto;
  }
}
`;
