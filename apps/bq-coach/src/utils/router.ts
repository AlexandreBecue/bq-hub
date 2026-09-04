import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/Home.vue'
import Session from '../views/Session.vue'
import Planning from '../views/Planning.vue'
import Running from '../views/Running.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/session', name: 'Session', component: Session },
  { path: '/planning', name: 'Planning', component: Planning },
  { path: '/running', name: 'Running', component: Running },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
