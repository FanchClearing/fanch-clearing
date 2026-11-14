import { Component } from 'react';

// 화면 하나가 터져도 하얗게 죽지 않고 다시 시도할 수 있게 한다.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('화면 오류', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen" style={{ textAlign: 'center', paddingTop: 120 }}>
        <p style={{ fontSize: 22 }}>앗, 문제가 생겼어요</p>
        <button className="px-btn" onClick={() => window.location.reload()}>
          다시 불러오기
        </button>
      </div>
    );
  }
}
