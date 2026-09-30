import React from 'react';
function SpaceDock({ space }) {
  return (
    <div className={'space-dock-wrap'}>
      <div
        className={'space-dock'}
        role={'tablist'}
        aria-label={'关于我或作品'}
        data-selected={space}
      >
        <i className={'space-dock-selection'} aria-hidden />
        {[
          ['about', '关于我', 'ABOUT'],
          ['works', '作品', 'WORK'],
        ].map(([id, label, en]) => (
          <button
            key={id}
            id={'tab-' + id}
            role={'tab'}
            aria-controls={id + '-space'}
            aria-selected={space === id}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('space-switch', {
                  detail: id,
                }),
              )
            }
          >
            {label}
            <small>{en}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
export { SpaceDock };
