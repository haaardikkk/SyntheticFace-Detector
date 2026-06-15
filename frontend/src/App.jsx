import Home from './pages/Home';

/**
 * App root — keep this minimal. All layout is inside Home.
 * Removed the outer <div className="App"> wrapper to eliminate
 * an extra layout layer that could cause stacking context issues.
 */
function App() {
  return <Home />;
}

export default App;
