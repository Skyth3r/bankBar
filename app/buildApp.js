const { Menu, clipboard } = require('electron'); // eslint-disable-line
const aboutMenu = require('../app/menus/about');
const contactMenu = require('../app/menus/contact');
const optionsMenu = require('../app/menus/options');
const convertToPositive = require('./utils/convertToPositive/convertToPositive');
const formatCurrency = require('./utils/formatCurrency/formatCurrency');
const get = require('./serviceCalls/get');
const debug = require('debug')('buildApp');
const checkAuth = require('./authentication/checkAuth');

const buildApp = async (store, tray) => {
  debug('building app');

  try {
    await checkAuth(store, tray);

    const balancePayload = await get(store, 'balance');
    const potsList = await get(store, 'pots');
    const transactionsList = await get(store, 'transactions');

    const { balance, currency, spend_today: spent } = balancePayload;
    const { pots } = potsList;
    const { transactions } = transactionsList;

    const potsSubmenu = pots
      .filter(p => !p.deleted)
      .map(p => ({
        label: `${p.name}:  £${formatCurrency(p.balance, p.currency)}`,
      }));

    const transactionsSubmenu = transactions
      .filter(t => t.scheme !== 'uk_retail_pot')
      .filter(t => t.amount < 0)
      .map((t) => {
        const merchantName = (t.merchant) ? t.merchant.name : t.description;
        return ({ label: `${merchantName}:  £${convertToPositive(formatCurrency(t.amount, t.currency))}` });
      });

    const formattedBalance = formatCurrency(balance, currency);
    const formattedSpend = formatCurrency(spent, currency);
    const positiveFormattedSpend = convertToPositive(formattedSpend, currency);

    const sortCode = store.get('sortCode');
    const accountNo = store.get('accountNo');

    const appMenu = Menu.buildFromTemplate([
      {
        label: `Spend today:  £${positiveFormattedSpend}`,
        submenu: transactionsSubmenu.length ? transactionsSubmenu.reverse() : null,
      },
      { type: 'separator' },
      potsSubmenu.length ? { label: 'Pots', submenu: potsSubmenu } : { label: 'Pots', enabled: false },
      { type: 'separator' },
      {
        label: 'Bank Details',
        submenu: [
          { label: `s/c: ${sortCode}`, click() { clipboard.writeText(sortCode); } },
          { label: `acc: ${accountNo}`, click() { clipboard.writeText(accountNo); } },
          { type: 'separator' },
          { label: '(click to copy)', enabled: false },
        ],
      },
      { type: 'separator' },
      optionsMenu(store),
      contactMenu,
      aboutMenu,
      { type: 'separator' },
      { label: 'Quit', role: 'quit' },
    ]);

    tray.setTitle(`£${formattedBalance}`);
    tray.setContextMenu(appMenu);

    debug('app built!');
  } catch (err) {
    debug('error building app: ', err);
  }
};

module.exports = async (store, tray) => {
  // initial build
  buildApp(store, tray);

  // rebuild every 10mins
  // todo: this is f*cking ugly
  setInterval(buildApp, 600000, store, tray);
};
