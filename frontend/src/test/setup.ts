import '@testing-library/jest-dom/vitest'

// JSDOM no implementa el desplazamiento de ventanas.
window.scrollTo = () => {}
