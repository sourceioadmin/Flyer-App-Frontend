import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.jsx'

console.log("VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL);
console.log("MODE:", import.meta.env.MODE);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
