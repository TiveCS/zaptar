import { Navigate, Route, HashRouter as Router, Routes } from 'react-router-dom'

import { Layout } from './components/Layout'
import { ComparePage } from './routes/ComparePage'
import { ConnectionsPage } from './routes/ConnectionsPage'
import { ErdPage } from './routes/ErdPage'
import { ResultPage } from './routes/ResultPage'

function App(): React.JSX.Element {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/connections" replace />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/erd" element={<ErdPage />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
