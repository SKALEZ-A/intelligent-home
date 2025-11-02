import React from 'react';
import './Loader.css';

interface LoaderProps {
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  text?: string;
}

export const Loader: React.FC<LoaderProps> = ({
  size = 'medium',
  fullScreen = false,
  text
}) => {
  const content = (
    <div className="loader__content">
      <div className={`loader loader--${size}`}>
        <div className="loader__spinner" />
      </div>
      {text && <p className="loader__text">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loader-container loader-container--fullscreen">
        {content}
      </div>
    );
  }

  return <div className="loader-container">{content}</div>;
};
