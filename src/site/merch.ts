import { addToBag, bagTotal, getBag, onBagChange, say } from './shell'

onBagChange(() => {
  document.getElementById('bag-total')!.textContent = `€${bagTotal()}`
})

document.querySelector('.merch')!.addEventListener('click', e => {
  const target = e.target as HTMLElement
  const add = target.closest<HTMLElement>('[data-add]')
  if (add) addToBag(add.dataset.add!)
  if (target.closest('[data-checkout]')) say(getBag().length ? 'checkout is just a mockup ˚₊·' : 'your bag is empty')
  if (target.closest('[data-notify]')) say("i'll tell you when the halo tee is back")
})
