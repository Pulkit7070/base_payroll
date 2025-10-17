'use client';

import { createBaseAccountSDK } from '@base-org/account';
import { useCallback, useEffect, useState } from 'react';
import { baseSepolia } from 'viem/chains';

interface SubAccount {
  address: `0x${string}`;
  factory?: `0x${string}`;
  factoryData?: `0x${string}`;
}

interface GetSubAccountsResponse {
  subAccounts: SubAccount[];
}

interface WalletAddSubAccountResponse {
  address: `0x${string}`;
  factory?: `0x${string}`;
  factoryData?: `0x${string}`;
}

export default function BaseSubAccountComponent() {
  const [provider, setProvider] = useState<ReturnType<
    ReturnType<typeof createBaseAccountSDK>['getProvider']
  > | null>(null);
  const [subAccount, setSubAccount] = useState<SubAccount | null>(null);
  const [universalAddress, setUniversalAddress] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [loadingSubAccount, setLoadingSubAccount] = useState(false);
  const [loadingTransaction, setLoadingTransaction] = useState(false);
  const [status, setStatus] = useState('');
  const [txHash, setTxHash] = useState('');

  // Initialize SDK
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        const sdkInstance = createBaseAccountSDK({
          appName: 'Bulk Payroll Base Account',
          appLogoUrl: 'https://base.org/logo.png',
          appChainIds: [baseSepolia.id],
        });

        const providerInstance = sdkInstance.getProvider();
        setProvider(providerInstance);
        setStatus('SDK initialized - ready to connect');
      } catch (error) {
        console.error('SDK initialization failed:', error);
        setStatus('SDK initialization failed');
      }
    };

    initializeSDK();
  }, []);

  const connectWallet = async () => {
    if (!provider) {
      setStatus('Provider not initialized');
      return;
    }

    setLoadingSubAccount(true);
    setStatus('Connecting wallet...');

    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
        params: [],
      })) as string[];

      const universalAddr = accounts[0];
      setUniversalAddress(universalAddr);
      setConnected(true);

      // Check for existing sub account
      const response = (await provider.request({
        method: 'wallet_getSubAccounts',
        params: [
          {
            account: universalAddr,
            domain: window.location.origin,
          },
        ],
      })) as GetSubAccountsResponse;

      const existing = response.subAccounts[0];
      if (existing) {
        setSubAccount(existing);
        setStatus(`Connected! Universal: ${universalAddr.slice(0, 6)}...${universalAddr.slice(-4)}`);
      } else {
        setStatus('Connected! No existing Sub Account found');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setStatus('Connection failed - make sure to use Phantom or compatible wallet');
    } finally {
      setLoadingSubAccount(false);
    }
  };

  const createSubAccount = async () => {
    if (!provider) {
      setStatus('Provider not initialized');
      return;
    }

    setLoadingSubAccount(true);
    setStatus('Creating Sub Account...');

    try {
      const newSubAccount = (await provider.request({
        method: 'wallet_addSubAccount',
        params: [
          {
            account: {
              type: 'create',
            },
          },
        ],
      })) as WalletAddSubAccountResponse;

      setSubAccount(newSubAccount);
      setStatus(`Sub Account created: ${newSubAccount.address.slice(0, 6)}...${newSubAccount.address.slice(-4)}`);
    } catch (error) {
      console.error('Sub Account creation failed:', error);
      setStatus('Sub Account creation failed');
    } finally {
      setLoadingSubAccount(false);
    }
  };

  const sendUSDCTransaction = useCallback(async () => {
    if (!subAccount || !provider) {
      setStatus('Sub account not available');
      return;
    }

    setLoadingTransaction(true);
    setStatus('Sending USDC transaction...');
    setTxHash('');

    try {
      // USDC contract on Base Sepolia Testnet: 0x036CbD53842c5426634E7929541eC2318f3dCd01
      // Transfer function selector + recipient + amount
      // amount: 1 USDC (6 decimals) = 1000000
      const usdcAmount = '1000000'; // 1 USDC

      const callsId = (await provider.request({
        method: 'wallet_sendCalls',
        params: [
          {
            version: '2.0',
            atomicRequired: true,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            from: subAccount.address,
            calls: [
              {
                to: '0x036CbD53842c5426634E7929541eC2318f3dCd01', // USDC contract on Base Sepolia
                data: `0xa9059cbb000000000000000000000000${
                  '70c573979F61710D3284120261B562e524ad3763'.toLowerCase().slice(2)
                }0000000000000000000000000000000000000000000000000000000000${parseInt(
                  usdcAmount
                ).toString(16)}`,
                value: '0x0',
              },
            ],
          },
        ],
      })) as string;

      setTxHash(callsId);
      setStatus(`Transaction sent! Calls ID: ${callsId.slice(0, 10)}...`);
    } catch (error) {
      console.error('Send transaction failed:', error);
      setStatus(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingTransaction(false);
    }
  }, [subAccount, provider]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-900">Base Sub Account Integration</h3>
        <p className="text-sm text-zinc-500">Connect Phantom wallet and test Base Sub Accounts</p>
      </div>

      <div className="mb-6 rounded-lg bg-zinc-50 p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-600">Status:</span>
            <span className="text-sm text-zinc-900">{status || 'Initializing...'}</span>
          </div>
          {universalAddress && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-600">Universal Account:</span>
              <code className="rounded bg-zinc-100 px-2 py-1 text-xs font-mono text-zinc-900">
                {universalAddress.slice(0, 6)}...{universalAddress.slice(-4)}
              </code>
            </div>
          )}
          {subAccount && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-600">Sub Account:</span>
              <code className="rounded bg-blue-100 px-2 py-1 text-xs font-mono text-blue-900">
                {subAccount.address.slice(0, 6)}...{subAccount.address.slice(-4)}
              </code>
            </div>
          )}
          {txHash && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-600">Calls ID:</span>
              <code className="rounded bg-green-100 px-2 py-1 text-xs font-mono text-green-900">
                {txHash.slice(0, 10)}...
              </code>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {!connected ? (
          <button
            onClick={connectWallet}
            disabled={loadingSubAccount || !provider}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loadingSubAccount ? 'Connecting...' : 'Connect Phantom Wallet'}
          </button>
        ) : !subAccount ? (
          <button
            onClick={createSubAccount}
            disabled={loadingSubAccount}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loadingSubAccount ? 'Creating...' : 'Create Sub Account'}
          </button>
        ) : (
          <>
            <button
              onClick={sendUSDCTransaction}
              disabled={loadingTransaction}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loadingTransaction ? 'Sending...' : 'Send 1 USDC Test Transaction'}
            </button>
            <button
              onClick={() => {
                setConnected(false);
                setSubAccount(null);
                setUniversalAddress('');
                setStatus('Disconnected');
                setTxHash('');
              }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
            >
              Disconnect
            </button>
          </>
        )}
      </div>

      <div className="mt-6 rounded-lg bg-blue-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-blue-900">How to use:</h4>
        <ol className="space-y-1 text-sm text-blue-800">
          <li>1. Click "Connect Phantom Wallet" to connect your Base Account</li>
          <li>2. Click "Create Sub Account" to create an app-specific sub account</li>
          <li>3. Click "Send 1 USDC Test Transaction" to test sending USDC</li>
          <li>4. Recipient: 0x70c573979F61710D3284120261B562e524ad3763</li>
        </ol>
      </div>
    </div>
  );
}
