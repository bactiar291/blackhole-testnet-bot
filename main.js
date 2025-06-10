import json
import os
import random
import time
import traceback
from web3 import Web3
from eth_utils import to_wei
import colorama
from colorama import Fore, Style

colorama.init(autoreset=True)

RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc"
w3 = Web3(Web3.HTTPProvider(RPC_URL))

def load_config():
    with open('config.json') as f:
        config = json.load(f)
    return config

config = load_config()

PRIVATE_KEY = config['private_key']
SENDER_ADDRESS = Web3.to_checksum_address(config['sender_address'])
VE_CONTRACT = Web3.to_checksum_address("0x11C2420efB5e03Dc75F8809d7f5bB47816De96F8")
TOKEN_CONTRACT = Web3.to_checksum_address("0xce5DE7aD7E108daec1793FBE357C49EFE60E82a4")
INCENTIVES_CONTRACT = Web3.to_checksum_address("0x611609DC1a47F55C643f98D5410e3300618730fE")

INCREASE_AMOUNT = 0.005
INCREASE_AMOUNT_WEI = int(INCREASE_AMOUNT * 10**18)
INCENTIVES_AMOUNT_AVAX = 0.0017
INCENTIVES_AMOUNT_WEI = int(INCENTIVES_AMOUNT_AVAX * 10**18)

ERC20_ABI = [
    {"name":"approve","inputs":[{"type":"address","name":"spender"},{"type":"uint256","name":"amount"}],"outputs":[{"type":"bool"}],"type":"function"},
    {"name":"allowance","inputs":[{"type":"address","name":"owner"},{"type":"address","name":"spender"}],"outputs":[{"type":"uint256"}],"type":"function","constant":True},
    {"name":"balanceOf","inputs":[{"type":"address","name":"owner"}],"outputs":[{"type":"uint256"}],"type":"function","constant":True}
]

ERC721_ABI = [
    {"name":"balanceOf","inputs":[{"type":"address","name":"owner"}],"outputs":[{"type":"uint256"}],"type":"function","constant":True},
    {"name":"tokenOfOwnerByIndex","inputs":[{"type":"address","name":"owner"},{"type":"uint256","name":"index"}],"outputs":[{"type":"uint256"}],"type":"function","constant":True}
]

token_contract = w3.eth.contract(address=TOKEN_CONTRACT, abi=ERC20_ABI)
ve_contract = w3.eth.contract(address=VE_CONTRACT, abi=ERC721_ABI)

main_token_id = None
new_token_id = None

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def display_header():
    print(Fore.CYAN + "=" * 70)
    print(Fore.YELLOW + "BLACKHOLE TESTNET BOT".center(70))
    print(Fore.CYAN + "=" * 70)
    print(Fore.GREEN + "FUNGSI:".ljust(20) + "Auto Lock | Auto Increase | Auto Merge | Auto Liquidity | Auto Stake")
    print(Fore.GREEN + "AUTHOR:".ljust(20) + "ANAM BACTIAR")
    print(Fore.CYAN + "=" * 70)

def countdown_timer(seconds):
    print(Fore.MAGENTA + "\n⏳ Menunggu transaksi berikutnya...")
    for i in range(seconds, 0, -1):
        mins, secs = divmod(i, 60)
        timer = f"{mins:02d}:{secs:02d}"
        print(Fore.YELLOW + f"⏱️ Waktu tersisa: {timer}", end='\r')
        time.sleep(1)
    print(" " * 50, end='\r')

def send_transaction(tx):
    try:
        signed_tx = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        print(Fore.CYAN + f"Tx Hash: 0x{tx_hash.hex()}")
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        if receipt.status == 1:
            print(Fore.GREEN + "✅ Transaction successful!")
            return True
        else:
            print(Fore.RED + "❌ Transaction failed!")
            return False
    except Exception as e:
        print(Fore.RED + f"⚠️ Transaction error: {str(e)}")
        traceback.print_exc()
        return False

def get_current_nonce():
    return w3.eth.get_transaction_count(SENDER_ADDRESS)

def int_to_32byte_hex(value):
    return format(value, '064x')

def address_to_32byte_hex(addr):
    return '000000000000000000000000' + addr.lower().replace('0x', '')

def approve(token_address, spender, amount_hex, nonce):
    data = '0x095ea7b3' + '000000000000000000000000' + spender.replace('0x', '').lower() + amount_hex
    return {
        'from': SENDER_ADDRESS,
        'to': token_address,
        'nonce': nonce,
        'gasPrice': w3.eth.gas_price,
        'gas': 70000,
        'chainId': 43113,
        'data': data
    }

ADDRESSES = {
    "router": "0x20Dc7C935b116Fba8826497A39c9eB599C0d6cF1",
    "super_token": "0xdDC18bF5f716742C746F156333f86E9c5bFbeC36",
    "black_token": "0xce5DE7aD7E108daec1793FBE357C49EFE60E82a4",
    "usdc_token": "0x0Ea98bF8ff474639f6Cbeb4c4bDd1bA74aA9A4a4",
    "usdc_black_lp": "0x8a43683080Ec0D207D128Aed182B7B8667Eb2Baa",
    "staking_contract": "0x919Fa62eb8B08cDE59c57800343d4FA4a64C5ed3"
}

def add_liquidity_tx(pair, nonce):
    deadline = int(time.time()) + 600
    method_id = '5a47ddc3'
    data = method_id
    data += address_to_32byte_hex(pair["tokenA"])
    data += address_to_32byte_hex(pair["tokenB"])
    data += int_to_32byte_hex(pair["poolId"])
    data += pair["amountADesired"]
    data += pair["amountBDesired"]
    data += pair["amountAMin"]
    data += pair["amountBMin"]
    data += address_to_32byte_hex(SENDER_ADDRESS)
    data += int_to_32byte_hex(deadline)
    return {
        'from': SENDER_ADDRESS,
        'to': ADDRESSES["router"],
        'nonce': nonce,
        'gasPrice': w3.eth.gas_price,
        'gas': pair["gas_limit"],
        'chainId': 43113,
        'data': '0x' + data
    }

def get_balance(token_address, owner):
    token = w3.eth.contract(address=token_address, abi=ERC20_ABI)
    return token.functions.balanceOf(owner).call()

def stake_lp(lp_balance, nonce):
    amount_hex = format(lp_balance, '064x')
    method_id = 'b6b55f25'
    data_payload = method_id + amount_hex
    return {
        'from': SENDER_ADDRESS,
        'to': ADDRESSES["staking_contract"],
        'nonce': nonce,
        'gasPrice': w3.eth.gas_price,
        'gas': 196818,
        'chainId': 43113,
        'data': '0x' + data_payload,
        'value': 0
    }

def add_liquidity_once():
    current_nonce = get_current_nonce()
    print(Fore.CYAN + f"\nCurrent nonce: {current_nonce}")
    pairs = [
        {
            "name": "SUPER/BLACK",
            "tokenA": ADDRESSES["black_token"],
            "tokenB": ADDRESSES["super_token"],
            "poolId": 1,
            "amountADesired": "00000000000000000000000000000000000000000000000000005af3107a4000",
            "amountBDesired": "0000000000000000000000000000000000000000000000000009aa820fd7ec5b",
            "amountAMin": "00000000000000000000000000000000000000000000000000005666e940f000",
            "amountBMin": "00000000000000000000000000000000000000000000000000092ec85bd9ed56",
            "gas_limit": 596054,
            "approve_token": ADDRESSES["super_token"],
            "approve_amount": "0000000000000000000000000000000000000000000000000009aa820fd7ec5b",
            "stake_after": False
        },
        {
            "name": "USDC/BLACK",
            "tokenA": ADDRESSES["usdc_token"],
            "tokenB": ADDRESSES["black_token"],
            "poolId": 1,
            "amountADesired": "00000000000000000000000000000000000000000000000000038d7ea4c68000",
            "amountBDesired": "000000000000000000000000000000000000000000000000000004c5990490af",
            "amountAMin": "000000000000000000000000000000000000000000000000000360051c896000",
            "amountBMin": "000000000000000000000000000000000000000000000000000004888491230d",
            "gas_limit": 586445,
            "approve_token": ADDRESSES["usdc_token"],
            "approve_amount": "00000000000000000000000000000000000000000000000000038d7ea4c68000",
            "stake_after": True
        }
    ]
    for pair in pairs:
        print(Fore.CYAN + f"\n=== PROCESSING {pair['name']} PAIR ===")
        print(f"Token A: {pair['tokenA']}")
        print(f"Token B: {pair['tokenB']}")
        print(f"Pool ID: {pair['poolId']}")
        print(f"Amount A Desired: 0x{pair['amountADesired']}")
        print(f"Amount B Desired: 0x{pair['amountBDesired']}")
        print(f"Amount A Min: 0x{pair['amountAMin']}")
        print(f"Amount B Min: 0x{pair['amountBMin']}")
        print(f"Gas Limit: {pair['gas_limit']}")
        print(Fore.YELLOW + f"Approving {pair['name']}...")
        approve_tx = approve(pair["approve_token"], ADDRESSES["router"], pair["approve_amount"], current_nonce)
        if send_transaction(approve_tx):
            current_nonce += 1
            time.sleep(15)
        else:
            print(Fore.RED + f"❌ Approval failed for {pair['name']}, skipping...")
            continue
        print(Fore.YELLOW + f"Adding liquidity for {pair['name']}...")
        liquidity_tx = add_liquidity_tx(pair, current_nonce)
        if send_transaction(liquidity_tx):
            current_nonce += 1
            time.sleep(20)
            if pair.get("stake_after", False):
                time.sleep(15)
                lp_balance = get_balance(ADDRESSES["usdc_black_lp"], SENDER_ADDRESS)
                print(Fore.CYAN + f"💰 Balance LP Token: {lp_balance} wei")
                if lp_balance > 0:
                    lp_token = w3.eth.contract(address=ADDRESSES["usdc_black_lp"], abi=ERC20_ABI)
                    allowance = lp_token.functions.allowance(SENDER_ADDRESS, ADDRESSES["staking_contract"]).call()
                    print(Fore.CYAN + f"🔄 Allowance untuk staking: {allowance} wei")
                    if allowance < lp_balance:
                        print(Fore.YELLOW + "⏳ Melakukan approve untuk staking...")
                        approve_tx = approve(ADDRESSES["usdc_black_lp"], ADDRESSES["staking_contract"], format(lp_balance, '064x'), current_nonce)
                        if send_transaction(approve_tx):
                            current_nonce += 1
                            time.sleep(15)
                        else:
                            print(Fore.RED + "❌ Gagal approve untuk staking, skip staking")
                            continue
                    else:
                        print(Fore.GREEN + "✅ Allowance sudah cukup")
                    print(Fore.YELLOW + "🚀 Melakukan staking LP token...")
                    stake_tx = stake_lp(lp_balance, current_nonce)
                    if send_transaction(stake_tx):
                        current_nonce += 1
                        time.sleep(15)
                        print(Fore.GREEN + "🎉 Staking berhasil!")
                    else:
                        print(Fore.RED + "❌ Gagal melakukan staking")
                else:
                    print(Fore.RED + "⚠️ Tidak ada LP token untuk di-stake")
        else:
            print(Fore.RED + f"❌ Add liquidity failed for {pair['name']}")

def check_allowance(owner, spender):
    return token_contract.functions.allowance(owner, spender).call()

def approve_token(spender, amount_wei):
    nonce = w3.eth.get_transaction_count(SENDER_ADDRESS)
    tx = token_contract.functions.approve(spender, amount_wei).build_transaction({
        'chainId': 43113,
        'gas': 70000,
        'gasPrice': w3.eth.gas_price,
        'nonce': nonce,
    })
    signed_tx = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    return tx_hash.hex()

def create_lock(amount_wei):
    lock_duration_hex = "000000000000000000000000000000000000000000000000000000000784ce00"
    isSMNFT_hex = "0000000000000000000000000000000000000000000000000000000000000001"
    value_hex = hex(amount_wei)[2:].zfill(64)
    data_payload = "0xbbf3ff15" + value_hex + lock_duration_hex + isSMNFT_hex
    transaction_params = {
        'chainId': 43113,
        'to': VE_CONTRACT,
        'value': 0,
        'gas': 1034106,
        'gasPrice': w3.eth.gas_price,
        'nonce': w3.eth.get_transaction_count(SENDER_ADDRESS),
        'data': data_payload
    }
    signed_tx = w3.eth.account.sign_transaction(transaction_params, PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    return tx_hash.hex()

def get_last_token_id():
    balance = ve_contract.functions.balanceOf(SENDER_ADDRESS).call()
    if balance == 0:
        return None
    token_id = ve_contract.functions.tokenOfOwnerByIndex(SENDER_ADDRESS, balance - 1).call()
    return token_id

def increase_amount(token_id, amount_wei):
    token_id_hex = hex(token_id)[2:].zfill(64)
    amount_hex = hex(amount_wei)[2:].zfill(64)
    data_payload = "0xa183af52" + token_id_hex + amount_hex
    transaction_params = {
        'chainId': 43113,
        'to': VE_CONTRACT,
        'value': 0,
        'gas': 533480,
        'gasPrice': w3.eth.gas_price,
        'nonce': w3.eth.get_transaction_count(SENDER_ADDRESS),
        'data': data_payload
    }
    signed_tx = w3.eth.account.sign_transaction(transaction_params, PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    return tx_hash.hex()

def merge_tokens(token_id_from, token_id_to):
    token_id_from_hex = hex(token_id_from)[2:].zfill(64)
    token_id_to_hex = hex(token_id_to)[2:].zfill(64)
    data_payload = "0xd1c2babb" + token_id_from_hex + token_id_to_hex
    transaction_params = {
        'chainId': 43113,
        'to': VE_CONTRACT,
        'value': 0,
        'gas': 990044,
        'gasPrice': w3.eth.gas_price,
        'nonce': w3.eth.get_transaction_count(SENDER_ADDRESS),
        'data': data_payload
    }
    signed_tx = w3.eth.account.sign_transaction(transaction_params, PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    return tx_hash.hex()

def do_incentives():
    token_hex = TOKEN_CONTRACT[2:].zfill(64)
    amount_hex = hex(INCENTIVES_AMOUNT_WEI)[2:].zfill(64)
    data_payload = "0xb66503cf" + token_hex + amount_hex
    transaction_params = {
        'chainId': 43113,
        'to': INCENTIVES_CONTRACT,
        'value': 0,
        'gas': 93000,
        'gasPrice': w3.eth.gas_price,
        'nonce': w3.eth.get_transaction_count(SENDER_ADDRESS),
        'data': data_payload
    }
    signed_tx = w3.eth.account.sign_transaction(transaction_params, PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    return tx_hash.hex()

def main_loop():
    global main_token_id, new_token_id
    while True:
        try:
            clear_screen()
            display_header()
            random_avax = round(random.uniform(0.00003, 0.00009), 6)
            random_wei = int(to_wei(random_avax, 'ether'))
            total_approval_wei = random_wei + INCREASE_AMOUNT_WEI
            print(Fore.CYAN + f"\n🔒 Memulai lock baru: {random_avax} AVAX ({random_wei} wei)")
            print(Fore.CYAN + f"📈 Jumlah increase: {INCREASE_AMOUNT} AVAX ({INCREASE_AMOUNT_WEI} wei)")
            current_ve_allowance = check_allowance(SENDER_ADDRESS, VE_CONTRACT)
            print(Fore.CYAN + f"🔄 Allowance untuk veBLACK: {current_ve_allowance} wei")
            if current_ve_allowance < total_approval_wei:
                print(Fore.YELLOW + "⏳ Allowance tidak cukup, melakukan approval...")
                approve_hash = approve_token(VE_CONTRACT, total_approval_wei)
                print(Fore.GREEN + f"✅ Approval berhasil! Hash: {approve_hash}")
                time.sleep(15)
            print(Fore.YELLOW + "🚀 Mengeksekusi create_lock...")
            lock_hash = create_lock(random_wei)
            print(Fore.GREEN + f"🎉 Lock berhasil! Hash: {lock_hash}")
            time.sleep(15)
            new_token_id = get_last_token_id()
            if new_token_id is None:
                raise Exception("Token ID baru tidak ditemukan")
            print(Fore.CYAN + f"🆔 Token ID baru: {new_token_id}")
            if main_token_id:
                print(Fore.YELLOW + f"📈 Meningkatkan jumlah token pada {new_token_id}...")
                increase_hash = increase_amount(new_token_id, INCREASE_AMOUNT_WEI)
                print(Fore.GREEN + f"✅ Increase berhasil! Hash: {increase_hash}")
                time.sleep(15)
                print(Fore.YELLOW + f"🔄 Menggabungkan {new_token_id} ke {main_token_id}...")
                merge_hash = merge_tokens(new_token_id, main_token_id)
                print(Fore.GREEN + f"✅ Merge berhasil! Hash: {merge_hash}")
                time.sleep(15)
            else:
                main_token_id = new_token_id
                print(Fore.GREEN + f"⭐ Token ID utama ditetapkan: {main_token_id}")
            print(Fore.CYAN + "\n💰 Memeriksa allowance untuk incentives...")
            allowance = check_allowance(SENDER_ADDRESS, INCENTIVES_CONTRACT)
            print(Fore.CYAN + f"🔄 Allowance untuk incentives: {allowance} wei")
            if allowance < INCENTIVES_AMOUNT_WEI:
                print(Fore.YELLOW + "⏳ Allowance tidak cukup, melakukan approve untuk incentives...")
                approve_hash = approve_token(INCENTIVES_CONTRACT, INCENTIVES_AMOUNT_WEI)
                print(Fore.GREEN + f"✅ Approve untuk incentives berhasil! Hash: {approve_hash}")
                time.sleep(15)
            else:
                print(Fore.GREEN + "✅ Allowance sudah cukup, lanjut ke incentives...")
            print(Fore.YELLOW + "🚀 Mengirim incentives...")
            incentives_hash = do_incentives()
            print(Fore.GREEN + f"🎉 Incentives berhasil! Hash: {incentives_hash}")
            sleep_time = random.randint(6, 12)
            countdown_timer(sleep_time)
        except Exception as e:
            print(Fore.RED + f"❌ Error: {str(e)}")
            traceback.print_exc()
            print(Fore.YELLOW + "🔄 Mencoba lagi dalam 30 detik...")
            time.sleep(30)

def init_main_token_id():
    global main_token_id
    balance = ve_contract.functions.balanceOf(SENDER_ADDRESS).call()
    if balance > 0:
        main_token_id = ve_contract.functions.tokenOfOwnerByIndex(SENDER_ADDRESS, 0).call()
        print(Fore.CYAN + f"🏷️ Token ID utama yang ada: {main_token_id}")

def check_avax_balance():
    balance = w3.eth.get_balance(SENDER_ADDRESS)
    avax_balance = w3.from_wei(balance, 'ether')
    print(Fore.CYAN + f"💰 AVAX Balance: {avax_balance} AVAX")
    if avax_balance < 0.01:
        print(Fore.RED + "⚠️ Peringatan: Saldo AVAX rendah! Pastikan untuk mengisi ulang.")
    return balance

if __name__ == "__main__":
    if not w3.is_connected():
        raise ConnectionError(Fore.RED + "❌ Gagal terhubung ke jaringan Avalanche")
    clear_screen()
    display_header()
    print(Fore.CYAN + "\n🤖 Bot veBLACK Locker & Incentives dimulai...")
    print(Fore.CYAN + f"💻 Alamat: {SENDER_ADDRESS}")
    print(Fore.CYAN + f"🔗 Kontrak Token: {TOKEN_CONTRACT}")
    print(Fore.CYAN + f"🔒 Kontrak veBLACK: {VE_CONTRACT}")
    print(Fore.CYAN + f"💰 Kontrak Incentives: {INCENTIVES_CONTRACT}")
    print(Fore.CYAN + f"💸 Jumlah Incentives: {INCENTIVES_AMOUNT_AVAX} AVAX")
    print(Fore.CYAN + f"🔒 Rentang Lock: 0.00003 - 0.00009 AVAX")
    balance = check_avax_balance()
    required_gas = (70000 * 3) + 296054 + 256445 + 196818
    if balance < required_gas:
        print(Fore.RED + f"⚠️ Saldo AVAX tidak cukup untuk liquidity! Required: {required_gas} wei")
        print(Fore.YELLOW + "Langkah penambahan liquidity akan dilewati...")
    else:
        print(Fore.CYAN + "\n" + "="*70)
        print(Fore.YELLOW + "🚀 MEMULAI PENAMBAHAN LIQUIDITY".center(70))
        print(Fore.CYAN + "="*70)
        add_liquidity_once()
        print(Fore.CYAN + "\n" + "="*70)
        print(Fore.GREEN + "✅ PENAMBAHAN LIQUIDITY SELESAI".center(70))
        print(Fore.CYAN + "="*70 + "\n")
    init_main_token_id()
    main_loop()
