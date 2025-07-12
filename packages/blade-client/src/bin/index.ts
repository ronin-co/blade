#!/usr/bin/env bun

import { version } from '@/src/../package.json';
import runCLI from 'blade-cli';

runCLI({ version });
