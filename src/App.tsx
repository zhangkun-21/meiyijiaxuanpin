import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ShelfPage from './pages/ShelfPage'
import ProductPage from './pages/ProductPage'
import PerformancePage from './pages/PerformancePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shelf" element={<ShelfPage />} />
        <Route path="/products" element={<ProductPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
