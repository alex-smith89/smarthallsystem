type LoadingScreenProps = {
  text?: string;
};

export default function LoadingScreen({
  text = 'Loading...'
}: LoadingScreenProps) {
  return (
    <div className="center-screen">
      <div className="loader-card">
        <div className="loader-spinner" />
        <h3 style={{ margin: '0 0 8px' }}>Please wait</h3>
        <p style={{ margin: 0, color: '#64748b' }}>{text}</p>
      </div>
    </div>
  );
}