import { useNavigate } from 'react-router-dom';
import './select.css';

export default function Home() {
  const navigate = useNavigate();
  return (
    <div className="screen center">
      <h1 className="logo">이의있음!</h1>
      <p className="subtitle">억울한 판정, 이제 흔들어서 따진다</p>
      <button className="px-btn big" onClick={() => navigate('/sports')}>
        START
      </button>
    </div>
  );
}
