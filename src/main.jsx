import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import MedicalDefense2050 from './MedicalDefense2050.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MedicalDefense2050 />
  </StrictMode>,
);
