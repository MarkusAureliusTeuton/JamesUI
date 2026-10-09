export const HOME_HERO_DECK_STYLES = `
[data-jui-layout="home-hero-deck"] {
  container-type: inline-size;
  display: grid;
  grid-template-rows: var(--jui-home-hero-ratio) minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

[data-jui-layout="home-hero-deck"] [data-jui-layout-region="hero"] {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

[data-jui-layout="home-hero-deck"] [data-jui-layout-region="deck"] {
  position: relative;
  min-width: 0;
  min-height: 0;
  margin-top: calc(var(--jui-space-6) * -1);
  padding: var(--jui-space-6);
  padding-bottom: 0;
  border-top: 1px solid var(--jui-color-border-strong);
  border-radius: var(--jui-radius-xl) var(--jui-radius-xl) 0 0;
  background: linear-gradient(180deg, var(--jui-color-surface), var(--jui-color-surface-raised));
  backdrop-filter: blur(var(--jui-blur-md));
  -webkit-backdrop-filter: blur(var(--jui-blur-md));
  box-shadow: var(--jui-shadow-surface), var(--jui-shadow-inset-highlight);
  overflow: hidden;
}

[data-jui-layout="home-hero-deck"] [data-jui-layout-slot="content"] {
  display: block;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

[data-jui-layout="home-hero-deck"] [data-jui-layout-slot="hero"] {
  height: 100%;
  min-height: 0;
  min-width: 0;
}
@container (max-width: 44rem) {
  [data-jui-layout="home-hero-deck"] [data-jui-layout-region="deck"] {
    padding-inline: var(--jui-space-4);
  }
}
`;
