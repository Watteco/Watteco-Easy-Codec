export type SensorPage = 'data' | 'config' | 'tools';

let pendingPage: SensorPage | null = null;

export const requestSensorPageTransition = (page: SensorPage) => {
  pendingPage = page;
};

export const cancelSensorPageTransition = () => {
  pendingPage = null;
};

export const playSensorPageTransition = (page: SensorPage, selector: string) => {
  if (pendingPage !== page) return;
  pendingPage = null;

  requestAnimationFrame(() => {
    const content = document.querySelector<HTMLElement>(selector);
    if (!content) return;

    const offset = page === 'data' ? '-16px' : '16px';
    content.animate(
      [
        { opacity: 0, transform: `translate3d(${offset}, 0, 0)` },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' },
      ],
      {
        duration: 220,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    );
  });
};
