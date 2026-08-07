import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PersonalityApp from './PersonalityApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersonalityApp />
  </StrictMode>,
)
